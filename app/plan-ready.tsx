import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { OnboardingView } from '@/components/OnboardingView';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function PlanReadyScreen() {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    trackPageViewed('onboarding_plan_ready');
    lottieRef.current?.play();
  }, []);

  return (
    <OnboardingView>
      <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.middle}>
          <View style={styles.lottieWrap}>
            <LottieView
              ref={lottieRef}
              source={require('../Sloth meditate.json')}
              style={styles.lottie}
              loop
            />
          </View>

          <Text style={styles.title}>Your Personalized Study Plan Is Ready</Text>

          <Text style={styles.body}>
          Answer 3 quick questions to see where you stand.
          </Text>

          <Text style={styles.hint}>Most students overestimate readiness by 20–30%.</Text>
        </View>

        <View style={styles.ctaWrap}>
          <Pressable style={styles.btn} onPress={() => router.replace('/micro-quiz')}>
            <Text style={styles.btnText}>Start My Assessment</Text>
          </Pressable>
        </View>
      </View>
      </LinearGradient>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: RESPONSIVE.horizontalPadding,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  lottieWrap: {
    width: scaleSize(220),
    height: scaleSize(220),
    marginBottom: scaleSize(28),
  },
  lottie: { width: '100%', height: '100%' },
  title: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(32),
    color: '#000',
    textAlign: 'center',
    marginBottom: scaleSize(24),
    lineHeight: scaleFont(40),
  },
  body: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(17),
    color: 'rgba(0,0,0,0.65)',
    textAlign: 'center',
    lineHeight: scaleFont(25),
    marginBottom: scaleSize(14),
  },
  hint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(13),
    color: 'rgba(0,0,0,0.4)',
    textAlign: 'center',
    marginBottom: scaleSize(48),
  },
  ctaWrap: { width: '100%', marginTop: 'auto' },
  btn: {
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: 'FredokaOne_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
});
