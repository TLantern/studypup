import { OnboardingView } from '@/components/OnboardingView';
import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { RESPONSIVE, SCREEN_WIDTH, scaleSize } from '@/lib/responsive';

const DURATION_MS = 2500;

const GRADIENT_LOTTIE = require('../assets/Progress Bar - Gradient.json');
const HERO_LOTTIE = require('../assets/connecting.json');

export default function CreatingPlanScreen() {
  const [elapsed, setElapsed] = useState(0);
  const heroLottieRef = useRef<LottieView>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const insets = useSafeAreaInsets();

  const lottieProgress = Math.min(1, elapsed / DURATION_MS);
  const percentLabel = `${Math.min(100, Math.round(lottieProgress * 100))}%`;

  useEffect(() => {
    trackPageViewed('onboarding_creating_plan');
    heroLottieRef.current?.play();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    const startedAt = Date.now();
    const tick = () => {
      if (cancelled) return;
      setElapsed(Date.now() - startedAt);
      if (Date.now() - startedAt < DURATION_MS) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => router.replace('/plan-ready'),
      DURATION_MS
    );
    return () => clearTimeout(t);
  }, [superwallAvailable]);

  const barWidth = Math.min(scaleSize(340), SCREEN_WIDTH - 2 * RESPONSIVE.horizontalPadding);

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Creating your Personalized Study Plan</Text>
      </View>
      <View style={styles.centerBlock}>
        <View style={styles.heroLottieWrap}>
          <LottieView
            ref={heroLottieRef}
            source={HERO_LOTTIE}
            style={styles.heroLottie}
            loop
          />
        </View>
      </View>
      <Text style={styles.timer}>{percentLabel}</Text>
      <View style={[styles.lottieWrap, { width: barWidth }]}>
        <LottieView
          source={GRADIENT_LOTTIE}
          progress={lottieProgress}
          loop={false}
          resizeMode="contain"
          style={styles.lottie}
        />
      </View>
      </View>
    </OnboardingView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE.horizontalPadding,
  },
  headerWrap: {
    width: '100%',
    paddingTop: scaleSize(16),
    paddingBottom: scaleSize(28),
    alignItems: 'center',
  },
  header: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: RESPONSIVE.titleMedium,
    color: '#333',
    textAlign: 'center',
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleSize(24),
  },
  heroLottieWrap: {
    width: scaleSize(200),
    height: scaleSize(200),
    marginBottom: scaleSize(16),
  },
  heroLottie: {
    width: '100%',
    height: '100%',
  },
  timer: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleSize(36),
    color: '#333',
    marginBottom: scaleSize(8),
  },
  lottieWrap: {
    aspectRatio: 1080 / 200,
    maxWidth: '100%',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
