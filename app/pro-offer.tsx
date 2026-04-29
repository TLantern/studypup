import { router } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { SuperwallAvailableContext, usePlacementHook, useSubscriptionStatus } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { scaleFont, scaleSize } from '@/lib/responsive';

const PLACEMENT = 'professionals_onboarding';
const FADE_IN = 600;
const HOLD = 1500;
const FADE_OUT = 600;
const TOTAL = FADE_IN + HOLD + FADE_OUT;

function navigateToMain() {
  router.replace('/create-account');
}

function Interstitial({ onDone }: { onDone: () => void }) {
  const opacity = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN }),
      withDelay(HOLD, withTiming(0, { duration: FADE_OUT }))
    );
    const t = setTimeout(onDone, TOTAL);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.glowCircle, styles.glowOuter]} />
      <View style={[styles.glowCircle, styles.glowMid]} />
      <View style={[styles.glowCircle, styles.glowInner]} />
      <Animated.View style={[styles.content, animStyle]}>
        <Text style={[styles.star, { top: -scaleSize(48), left: scaleSize(10) }]}>✦</Text>
        <Text style={[styles.star, styles.starLg, { top: -scaleSize(36), left: scaleSize(52) }]}>✦</Text>
        <Text style={[styles.star, styles.starSm, { top: scaleSize(8), left: -scaleSize(20) }]}>✦</Text>
        <Text style={[styles.star, styles.starSm, { bottom: scaleSize(4), right: -scaleSize(24) }]}>✦</Text>
        <Text style={styles.tryText}>We want you to try</Text>
        <Text style={styles.daysText}>for 3 days,</Text>
        <Text style={styles.freeText}>For free!</Text>
      </Animated.View>
    </View>
  );
}

function ProOfferWithSuperwall() {
  const usePlacement = usePlacementHook!;
  const subscriptionStatus = useSubscriptionStatus();
  const didRegister = useRef(false);

  const { registerPlacement } = usePlacement({
    onDismiss: navigateToMain,
    onSkip: navigateToMain,
    onError: navigateToMain,
  });

  const triggerPlacement = useCallback(() => {
    if (didRegister.current) return;
    didRegister.current = true;
    trackPageViewed('professionals_onboarding_placement');
    registerPlacement({ placement: PLACEMENT, feature: navigateToMain }).catch(navigateToMain);
  }, [registerPlacement]);

  useEffect(() => {
    trackPageViewed('pro_offer_interstitial');
    if (subscriptionStatus === 'active') { navigateToMain(); }
  }, []);

  return <Interstitial onDone={triggerPlacement} />;
}

function ProOfferWithoutSuperwall() {
  useEffect(() => {
    trackPageViewed('pro_offer_interstitial');
  }, []);
  return <Interstitial onDone={navigateToMain} />;
}

export default function ProOfferScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  return superwallAvailable ? <ProOfferWithSuperwall /> : <ProOfferWithoutSuperwall />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#7FA8FF',
  },
  glowOuter: {
    width: scaleSize(480),
    height: scaleSize(480),
    opacity: 0.06,
  },
  glowMid: {
    width: scaleSize(340),
    height: scaleSize(340),
    opacity: 0.11,
  },
  glowInner: {
    width: scaleSize(200),
    height: scaleSize(200),
    opacity: 0.18,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: scaleFont(18),
    color: '#2D9D52',
    marginBottom: scaleSize(2),
  },
  daysText: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: scaleFont(34),
    color: '#0D0D0F',
    letterSpacing: -0.5,
    marginBottom: scaleSize(2),
  },
  freeText: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: scaleFont(34),
    color: '#0D0D0F',
    letterSpacing: -0.5,
  },
  star: {
    position: 'absolute',
    fontSize: scaleFont(18),
    color: '#7FA8FF',
  },
  starLg: {
    fontSize: scaleFont(26),
  },
  starSm: {
    fontSize: scaleFont(12),
  },
});
