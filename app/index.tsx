import { Audio, ResizeMode, Video } from 'expo-av';
import { router } from 'expo-router';
import { useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, scaleSize, SCREEN_WIDTH, SCREEN_HEIGHT, RESPONSIVE } from '@/lib/responsive';
import { useAuth } from '@/lib/auth-store';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const WELCOME_MP3 = require('../audio/welcomeaudio.mp3');
const DEMO_VIDEO = require('../assets/demovidd.mp4');

const DEMO_VIDEO_WIDTH = Math.min(SCREEN_WIDTH * 0.54, scaleSize(230));

const WELCOME_RESPONSIVE = {
  titleFontSize: scaleFont(36),
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const welcomeSound = useRef<Audio.Sound | null>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const { uid, loading } = useAuth();

  useEffect(() => {
    trackPageViewed('onboarding_welcome');
  }, []);

  useEffect(() => {
    if (!loading && uid) {
      router.replace('/(tabs)');
    }
  }, [uid, loading]);

  useEffect(() => {
    if (uid) return;
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(WELCOME_MP3);
        if (!mounted) {
          sound.unloadAsync();
          return;
        }
        welcomeSound.current = sound;
        await sound.playAsync();
      } catch (_) {}
    })();
    return () => {
      mounted = false;
      welcomeSound.current?.unloadAsync();
    };
  }, [uid]);

  if (loading || uid) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Better Grades{'\n'}Less Studying</Text>
      <Text style={styles.subtext}>Turn notes into exactly what’s on your exam</Text>
      <View style={styles.videoShadowWrap}>
        <View style={styles.videoInner}>
          <Video
            source={DEMO_VIDEO}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
          />
        </View>
      </View>
      <View style={styles.buttons}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/record')}>
          <Text style={[styles.btnText, styles.btnPrimaryText]}>Get Started</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnLogin]} onPress={() => router.push(superwallAvailable ? { pathname: '/create-account', params: { then: 'paywall' } } : '/create-account')}>
          <Text style={[styles.btnText, styles.btnLoginText]}>Login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#AADDDD', 
    paddingHorizontal: RESPONSIVE.containerPadding 
  },
  title: { 
    fontFamily: 'FredokaOne_400Regular', 
    fontSize: WELCOME_RESPONSIVE.titleFontSize, 
    color: '#000', 
    textAlign: 'center', 
    lineHeight: WELCOME_RESPONSIVE.titleFontSize + 2 
  },
  subtext: { 
    fontFamily: 'Fredoka_400Regular', 
    fontSize: scaleFont(16), 
    color: '#333', 
    textAlign: 'center', 
    marginTop: scaleSize(8) 
  },
  videoShadowWrap: {
    alignSelf: 'center',
    marginTop: scaleSize(16),
    marginBottom: scaleSize(4),
    borderRadius: scaleSize(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 16,
  },
  videoInner: {
    width: DEMO_VIDEO_WIDTH,
    aspectRatio: 9 / 18,
    borderRadius: scaleSize(20),
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  buttons: { 
    gap: scaleSize(16), 
    paddingTop: SCREEN_HEIGHT * 0.04,
    paddingHorizontal: scaleSize(8),
  },
  btn: {
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(40),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: RESPONSIVE.buttonMinHeight,
    ...BUTTON_SHADOW,
  },
  btnPrimary: { backgroundColor: '#FD8A8A', borderColor: '#CA6E6E' },
  btnLogin: { backgroundColor: '#E8E8E8', borderColor: '#B9B9B9' },
  btnText: { 
    fontFamily: 'Fredoka_400Regular', 
    fontSize: scaleFont(22),
    textAlign: 'center',
  },
  btnPrimaryText: { color: '#fff' },
  btnLoginText: { color: '#000' },
});
