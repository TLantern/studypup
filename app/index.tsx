import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, scaleSize, SCREEN_WIDTH, RESPONSIVE } from '@/lib/responsive';
import { useAuth } from '@/lib/auth-store';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const ENTRANCE_OFFSET = 280;
const ENTRANCE_DURATION = 600;
const IDLE_CIRCLE_RADIUS = 10;
const IDLE_CIRCLE_DURATION = 4000;
const IDLE_SCALE_DELTA = 0.02;
const TWO_PI = 2 * Math.PI;

function useLogoAnimation() {
  const entrance = useSharedValue(0);
  const idleAngle = useSharedValue(0);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: ENTRANCE_DURATION, easing: Easing.out(Easing.cubic) });
    idleAngle.value = withRepeat(
      withTiming(TWO_PI, { duration: IDLE_CIRCLE_DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = idleAngle.value;
    return {
      transform: [
        { translateX: (1 - entrance.value) * -ENTRANCE_OFFSET + IDLE_CIRCLE_RADIUS * Math.cos(angle) },
        { translateY: (1 - entrance.value) * ENTRANCE_OFFSET + IDLE_CIRCLE_RADIUS * Math.sin(angle) },
        { scale: 1 + IDLE_SCALE_DELTA * Math.sin(angle) },
      ],
    };
  });

  return animatedStyle;
}

const WELCOME_MP3 = require('../audio/welcomeaudio.mp3');

// Screen-specific responsive dimensions
const WELCOME_RESPONSIVE = {
  titleFontSize: scaleFont(36),
  logoSize: Math.min(SCREEN_WIDTH * 0.5, 200),
  starsRowWidth: Math.min(SCREEN_WIDTH * 0.88, 360),
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const logoStyle = useLogoAnimation();
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
    <View style={[styles.container, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Welcome to{'\n'}Studypup!</Text>
      <Text style={styles.subtext}>Unlock Your Academic Potential.</Text>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={require('../assets/images/puppylogoo.png')} style={styles.logo} contentFit="contain" />
      </Animated.View>
      <View style={styles.socialProof}>
        <Text style={styles.socialProofText}>
          Join 3,500+ students studying smarter{'\n'}with StudyPup
        </Text>
        <Image
          source={require('../assets/5stars-removebg-preview.png')}
          style={[styles.starsImage, { width: WELCOME_RESPONSIVE.starsRowWidth }]}
          contentFit="contain"
        />
      </View>
      <View style={styles.buttonsSpacer} />
      <View style={styles.buttons}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/record')}>
          <Text style={[styles.btnText, styles.btnPrimaryText]}>Get Started</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(superwallAvailable ? { pathname: '/create-account', params: { then: 'paywall' } } : '/create-account')}
          style={styles.loginPromptWrap}
        >
          <Text style={styles.loginPrompt}>
            Already have an account? <Text style={styles.loginPromptLink}>Log in</Text>
          </Text>
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
    fontSize: scaleFont(20), 
    color: '#333', 
    textAlign: 'center', 
    marginTop: scaleSize(8) 
  },
  logoWrap: {
    alignSelf: 'center',
    marginTop: scaleSize(24),
    marginBottom: scaleSize(32),
  },
  logo: {
    width: WELCOME_RESPONSIVE.logoSize,
    height: WELCOME_RESPONSIVE.logoSize,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  socialProof: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(14),
    paddingVertical: scaleSize(12),
    paddingHorizontal: scaleSize(18),
    marginBottom: scaleSize(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  socialProofText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(12),
    color: '#5A5A5A',
    textAlign: 'center',
    lineHeight: scaleFont(15),
    marginBottom: scaleSize(4),
  },
  starsImage: {
    height: scaleSize(28),
  },
  buttonsSpacer: { flex: 1, minHeight: scaleSize(32) },
  buttons: { 
    gap: scaleSize(16), 
    paddingBottom: scaleSize(16),
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
  btnText: { 
    fontFamily: 'Fredoka_400Regular', 
    fontSize: scaleFont(22),
    textAlign: 'center',
  },
  btnPrimaryText: { color: '#fff' },
  loginPromptWrap: { alignItems: 'center', paddingVertical: scaleSize(12) },
  loginPrompt: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(17),
    color: '#333',
    textAlign: 'center',
  },
  loginPromptLink: { color: '#000', fontFamily: 'Fredoka_400Regular', textDecorationLine: 'underline' },
});
