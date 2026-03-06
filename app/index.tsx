import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, scaleSize, SCREEN_WIDTH, SCREEN_HEIGHT, RESPONSIVE } from '@/lib/responsive';
import { useAuth } from '@/lib/auth-store';
import { getItem, setItem } from '@/lib/storage';
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
  userChoiceBadgeWidth: SCREEN_WIDTH * 0.9,
  userChoiceBadgeHeight: scaleSize(75),
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const logoStyle = useLogoAnimation();
  const welcomeSound = useRef<Audio.Sound | null>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const { uid, loading } = useAuth();

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
        const played = await getItem('welcome_audio_played');
        if (played) return;
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const { sound } = await Audio.Sound.createAsync(WELCOME_MP3);
        if (!mounted) {
          sound.unloadAsync();
          return;
        }
        welcomeSound.current = sound;
        await sound.playAsync();
        await setItem('welcome_audio_played', 'true');
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
      <View style={styles.userChoiceRow}>
        <Image source={require('../assets/icons/userchoice.png')} style={styles.userChoiceBadge} contentFit="contain" />
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
    fontSize: scaleFont(20), 
    color: '#333', 
    textAlign: 'center', 
    marginTop: scaleSize(8) 
  },
  logoWrap: {
    alignSelf: 'center',
    marginVertical: scaleSize(24),
    marginBottom: 0,
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
  userChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleSize(8),
    marginTop: scaleSize(-16),
    marginBottom: scaleSize(8),
  },
  userChoiceBadge: { 
    width: WELCOME_RESPONSIVE.userChoiceBadgeWidth, 
    height: WELCOME_RESPONSIVE.userChoiceBadgeHeight,
    maxWidth: scaleSize(440),
  },
  buttons: { 
    gap: scaleSize(16), 
    paddingTop: SCREEN_HEIGHT * 0.12,
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
