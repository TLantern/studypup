import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { getItem, setItem } from '@/lib/storage';
import { signInWithGoogle, signInWithApple, googleStatusCodes } from '@/lib/auth';
import * as StoreReview from 'expo-store-review';
import { scaleFont, scaleSize, SCREEN_WIDTH } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { ttTrackRegistration, ttIdentify } from '@/lib/tiktok-analytics';
import ReAnimated, { SlideInRight, SlideOutLeft, useSharedValue, useAnimatedStyle, withTiming, Easing as ReEasing } from 'react-native-reanimated';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

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

const CAROUSEL_ITEMS = [
  '📸 Snap your notes and get instant flashcards',
  '🧠 AI quizzes tailored to you',
  '⚡ Study smarter, not longer',
];
const CAROUSEL_INTERVAL = 3600;

function useCarousel() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: CAROUSEL_INTERVAL, easing: ReEasing.linear });
    const id = setInterval(() => {
      setCarouselIndex(i => (i + 1) % CAROUSEL_ITEMS.length);
      progress.value = 0;
      progress.value = withTiming(1, { duration: CAROUSEL_INTERVAL, easing: ReEasing.linear });
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as any }));
  return { carouselIndex, progressStyle };
}

function ShineButton({
  label,
  icon,
  onPress,
  disabled,
  delayMs = 0,
  buttonStyle,
  textStyle,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  delayMs?: number;
  buttonStyle?: object;
  textStyle?: object;
}) {
  const shineX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    const run = () => {
      shineX.setValue(-SCREEN_WIDTH * 0.6);
      Animated.timing(shineX, {
        toValue: SCREEN_WIDTH * 0.6,
        duration: 650,
        useNativeDriver: true,
      }).start();
    };
    const initial = setTimeout(run, delayMs);
    const interval = setInterval(run, 3200);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  return (
    <Pressable
      style={[styles.socialBtn, buttonStyle, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon}
      <Text style={[styles.socialBtnText, textStyle]}>{label}</Text>
      <Animated.View
        style={[styles.shineSweep, { transform: [{ translateX: shineX }] }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: SCREEN_WIDTH * 0.35, height: '100%' }}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ then?: string; mode?: string }>();
  const { uid, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { carouselIndex, progressStyle } = useCarousel();

  useEffect(() => {
    trackPageViewed('create_account');
  }, []);

  useEffect(() => {
    getItem('review:shown').then(async (shown) => {
      if (!shown) {
        await setItem('review:shown', 'true');
        if (await StoreReview.hasAction()) StoreReview.requestReview();
      }
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    ttTrackRegistration();
    ttIdentify(uid, user?.email ?? '');
    if (params.then === 'paywall') router.replace('/paywall');
    else router.replace('/(tabs)');
  }, [uid, params.then]);

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.code !== googleStatusCodes.SIGN_IN_CANCELLED) {
        setError(e?.message ?? 'Google sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e?.message ?? 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>
            {params.mode === 'login' ? 'Log in to your account' : 'Sign up to get started'}
          </Text>

          <View style={styles.centeredBlock}>
          <View style={styles.socialProof}>
            <Text style={styles.socialProofText}>Join 3,500+ students studying smarter</Text>
            <View style={styles.starsRow}>
              <Stars rating={4.7} />
              <Text style={styles.starsRating}>4.7</Text>
            </View>
          </View>
          <View style={styles.carouselCard}>
            <View style={styles.carousel}>
              <ReAnimated.Text
                key={carouselIndex}
                entering={SlideInRight.duration(380)}
                exiting={SlideOutLeft.duration(300)}
                style={[styles.carouselText, { position: 'absolute' }]}
              >
                {CAROUSEL_ITEMS[carouselIndex]}
              </ReAnimated.Text>
            </View>
            <View style={styles.progressTrack}>
              <ReAnimated.View style={[styles.progressBar, progressStyle]} />
            </View>
          </View>

          <ShineButton
            label="Continue with Google"
            icon={<Image source={require('@/assets/icons/google.png')} style={styles.socialIcon} contentFit="contain" />}
            onPress={handleGoogle}
            disabled={busy}
            delayMs={400}
            buttonStyle={styles.googleBtn}
          />
          <ShineButton
            label="Continue with Apple"
            icon={<Image source={require('@/assets/icons/apple.png')} style={[styles.socialIcon, styles.socialIconWhite]} contentFit="contain" />}
            onPress={handleApple}
            disabled={busy}
            delayMs={1800}
            buttonStyle={styles.appleBtn}
            textStyle={{ color: '#fff' }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.phoneBtn}
            onPress={() => router.push({ pathname: '/phone-login', params: { then: params.then } })}
          >
            <Text style={styles.phoneBtnText}>Login with phone number</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SCREEN_WIDTH * 0.06, justifyContent: 'space-between' },
  centeredBlock: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(32), color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333', textAlign: 'center', marginBottom: scaleSize(16) },
  socialProof: { alignItems: 'center', alignSelf: 'center', marginBottom: scaleSize(10), gap: scaleSize(4) },
  socialProofText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(15), color: '#444', textAlign: 'center' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(4) },
  starsRating: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(15), color: '#333' },
  carouselCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: scaleSize(16),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(14),
    marginBottom: scaleSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  carousel: {
    alignItems: 'center',
    justifyContent: 'center',
    height: scaleSize(40),
    overflow: 'hidden',
    width: '100%',
    marginBottom: scaleSize(8),
  },
  carouselText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#222', textAlign: 'center' },
  progressTrack: { height: scaleSize(4), backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: scaleSize(4), overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#FD8A8A', borderRadius: scaleSize(4) },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    marginBottom: scaleSize(12),
    minHeight: scaleSize(56),
    overflow: 'hidden',
    ...BUTTON_SHADOW,
  },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  appleBtn: { backgroundColor: '#000' },
  socialIcon: { width: scaleSize(22), height: scaleSize(22), marginRight: scaleSize(10) },
  socialIconWhite: { tintColor: '#fff' },
  socialBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333' },
  shineSweep: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleSize(16), marginTop: scaleSize(4) },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ccc' },
  dividerText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#333', marginHorizontal: scaleSize(16) },
  phoneBtn: {
    alignItems: 'center',
    paddingVertical: scaleSize(14),
  },
  phoneBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(17),
    color: '#333',
    textDecorationLine: 'underline',
  },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(14), color: '#b91c1c', marginTop: scaleSize(8), textAlign: 'center' },
});
