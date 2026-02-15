import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const logoStyle = useLogoAnimation();
  const welcomeSound = useRef<Audio.Sound | null>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);

  useEffect(() => {
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
  }, []);

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
  container: { flex: 1, backgroundColor: '#AADDDD', paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 40, color: '#000', textAlign: 'center', lineHeight: 42 },
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#333', textAlign: 'center', marginTop: 8 },
  logoWrap: {
    alignSelf: 'center',
    marginVertical: 24,
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 200,
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
    gap: 8,
    marginTop: -16,
    marginBottom: 8,
    marginRight: -15,
  },
  userChoiceBadge: { width: 440, height: 88 },
  buttons: { gap: 16, paddingTop: 140 },
  btn: {
    borderRadius: 35,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...BUTTON_SHADOW,
  },
  btnPrimary: { backgroundColor: '#FD8A8A', borderColor: '#CA6E6E' },
  btnLogin: { backgroundColor: '#E8E8E8', borderColor: '#B9B9B9' },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24 },
  btnPrimaryText: { color: '#fff' },
  btnLoginText: { color: '#000' },
});
