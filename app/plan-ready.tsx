import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';
import { DEEP_BLACK, ACCENT_BLUE, SUBTITLE_GRAY, MUTED_TEXT, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';

export default function PlanReadyScreen() {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    trackPageViewed('ob_student_plan_ready');
    lottieRef.current?.play();
  }, []);

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(32) }]}>
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
          <Text style={styles.body}>Answer 3 quick questions to see where you stand.</Text>
          <Text style={styles.hint}>Most students overestimate readiness by 20–30%.</Text>
        </View>

        <View style={styles.ctaWrap}>
          <Pressable
            style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
            onPress={() => { hapticContinue(); router.replace('/micro-quiz'); }}
          >
            <Text style={styles.continueBtnText}>Start My Assessment</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: RESPONSIVE.horizontalPadding,
    alignItems: 'center',
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
    fontFamily: SF_PRO,
    fontSize: scaleFont(26),
    fontWeight: '700',
    color: DEEP_BLACK,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: scaleSize(16),
    lineHeight: scaleFont(34),
  },
  body: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    lineHeight: scaleFont(24),
    marginBottom: scaleSize(10),
  },
  hint: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: MUTED_TEXT,
    textAlign: 'center',
    marginBottom: scaleSize(48),
  },
  ctaWrap: { width: '100%' },
  continueBtn: sharedStyles.continueBtn,
  continueBtnPressed: { opacity: 0.85 },
  continueBtnText: sharedStyles.continueBtnText,
});
