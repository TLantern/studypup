import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackEvent } from '@/lib/mixpanel';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const DURATION_MS = 6000;

export default function CreatingPlanScreen() {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackEvent('creating-plan');
      tracked.current = true;
    }
  }, []);
  useEffect(() => {
    lottieRef.current?.play();
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => router.replace('/rating'),
      DURATION_MS
    );
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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

const LOTTIE_SIZE = scaleSize(260);

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
    fontSize: scaleFont(22),
    color: '#333',
    textAlign: 'center',
    marginBottom: scaleSize(40),
  },
  lottieWrap: {
    width: LOTTIE_SIZE,
    height: LOTTIE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: LOTTIE_SIZE,
    height: LOTTIE_SIZE,
  },
});
