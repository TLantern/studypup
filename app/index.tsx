import { MeshGradientBackground } from '@/components/MeshGradientBackground';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
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
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';

const BUTTON_SHADOW = {
  shadowColor: '#1a1a1a',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.55,
  shadowRadius: 10,
  elevation: 10,
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

const CAROUSEL_ITEMS = [
  '📸 Snap your notes and get instant flashcards',
  '🧠 AI quizzes tailored to you',
  '⚡ Study smarter, not longer',
];
const CAROUSEL_INTERVAL = 3600;

function useCarousel() {
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: CAROUSEL_INTERVAL, easing: Easing.linear });
    const id = setInterval(() => {
      setIndex(i => (i + 1) % CAROUSEL_ITEMS.length);
      progress.value = 0;
      progress.value = withTiming(1, { duration: CAROUSEL_INTERVAL, easing: Easing.linear });
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as any }));

  return { index, progressStyle };
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const frac = rating - full;
  const sz = scaleFont(15);
  return (
    <View style={{ flexDirection: 'row' }}>
      {[...Array(full)].map((_, i) => <Text key={i} style={{ fontSize: sz, color: '#FFA500' }}>★</Text>)}
      <View style={{ position: 'relative', width: sz }}>
        <Text style={{ fontSize: sz, color: '#DDD' }}>★</Text>
        <View style={{ position: 'absolute', top: 0, left: 0, width: sz * frac, overflow: 'hidden' }}>
          <Text style={{ fontSize: sz, color: '#FFA500' }}>★</Text>
        </View>
      </View>
    </View>
  );
}

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
  const { index: carouselIndex, progressStyle } = useCarousel();

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
      <MeshGradientBackground />
      <Text style={styles.title}>Welcome to{'\n'}Studypup!</Text>
      <Text style={styles.subtext}> AI Study Tool built for students</Text>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={require('../assets/images/puppylogoo.png')} style={styles.logo} contentFit="contain" />
      </Animated.View>
      <View style={styles.socialProof}>
        <Text style={styles.socialProofText}>Join 3,500+ students studying smarter</Text>
        <View style={styles.starsRow}>
          <Stars rating={4.7} />
          <Text style={styles.starsRating}>4.7</Text>
        </View>
      </View>
      <View style={styles.buttonsSpacer} />
      <View style={styles.carouselCard}>
        <View style={styles.carousel}>
          <Animated.Text
            key={carouselIndex}
            entering={SlideInRight.duration(380)}
            exiting={SlideOutLeft.duration(300)}
            style={[styles.carouselText, { position: 'absolute' }]}
          >
            {CAROUSEL_ITEMS[carouselIndex]}
          </Animated.Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, progressStyle]} />
        </View>
      </View>
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
    paddingHorizontal: RESPONSIVE.containerPadding,
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
    marginBottom: scaleSize(8),
    gap: scaleSize(6),
  },
  socialProofText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(15),
    color: '#444',
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(4),
  },
  starsEmoji: {
    fontSize: scaleFont(15),
    color: '#FFA500',
  },
  starsRating: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(15),
    color: '#333',
  },
  reviewsText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#5A5A5A',
  },
  buttonsSpacer: { flex: 1, minHeight: scaleSize(16) },
  carouselCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: scaleSize(16),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(14),
    marginBottom: scaleSize(28),
    marginHorizontal: scaleSize(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  carousel: {
    alignItems: 'center',
    justifyContent: 'center',
    height: scaleSize(56),
    overflow: 'hidden',
    width: '100%',
    marginBottom: scaleSize(10),
  },
  carouselText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(17),
    color: '#222',
    textAlign: 'center',
  },
  progressTrack: {
    height: scaleSize(4),
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: scaleSize(4),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FD8A8A',
    borderRadius: scaleSize(4),
  },
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
  btnPrimary: { backgroundColor: '#E86E6E', borderColor: '#B85555' },
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
