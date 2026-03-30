import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useContext, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { RESPONSIVE, scaleSize } from '@/lib/responsive';

const DURATION_MS = 6000;

export default function CreatingPlanScreen() {
  const lottieRef = useRef<LottieView>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('onboarding_creating_plan');
    lottieRef.current?.play();
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => router.replace('/plan-ready'),
      DURATION_MS
    );
    return () => clearTimeout(t);
  }, [superwallAvailable]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
      <Text style={styles.text}>Creating your Personalized Study Plan</Text>
      <View style={styles.lottieWrap}>
        <LottieView
          ref={lottieRef}
          source={require('../connecting.json')}
          style={styles.lottie}
          loop
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE.horizontalPadding,
  },
  text: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.subtitle,
    color: '#333',
    textAlign: 'center',
    marginBottom: scaleSize(32),
  },
  lottieWrap: {
    width: scaleSize(280),
    height: scaleSize(280),
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
