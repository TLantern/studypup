import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { RESPONSIVE, scaleSize, scaleFont, scaleVertical } from '@/lib/responsive';
import { trackPageViewed, trackEvent } from '@/lib/analytics';
import { hapticSelect, hapticContinue } from '@/lib/haptics';
import { ACCENT_BLUE, ACCENT_BLUE_TINT, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { SuperwallAvailableContext } from '@/lib/superwall';

const MIN_GPA = 0.0;
const MAX_GPA = 4.0;
const STEP = 0.1;
const DEFAULT_GPA = 2.5;

export default function CurrentGpaScreen() {
  const insets = useSafeAreaInsets();
  const [gpa, setGpa] = useState(DEFAULT_GPA);
  const superwallAvailable = useContext(SuperwallAvailableContext);

  useEffect(() => {
    trackPageViewed('ob_student_current_gpa');
  }, []);

  const adjust = (delta: number) => {
    hapticSelect();
    setGpa((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.min(MAX_GPA, Math.max(MIN_GPA, next));
    });
  };

  const handleContinue = async () => {
    hapticContinue();
    const value = gpa.toFixed(1);
    await updateOnboarding({ current_gpa: value });
    trackEvent('ob_student_current_gpa_selected', { gpa: value });
    router.push('/target-gpa');
  };

  const handleSkip = () => {
    hapticSelect();
    trackEvent('ob_student_current_gpa_skipped');
    if (superwallAvailable) router.push('/paywall');
    else router.replace('/create-account');
  };

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.70} onSkip={handleSkip} />}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Personalizing your Notario...</Text>
        <Text style={styles.title}>What is your GPA now?</Text>
        
        <View style={styles.center}>
          <View style={styles.tracker}>
            <Pressable onPress={() => adjust(-STEP)} hitSlop={16} style={styles.stepBtn}>
              <Text style={styles.symbol}>−</Text>
            </Pressable>
            <Text style={styles.gpaText}>{gpa.toFixed(1)}</Text>
            <Pressable onPress={() => adjust(STEP)} hitSlop={16} style={styles.stepBtn}>
              <Text style={styles.symbol}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + scaleSize(16) }]}>
          <Pressable style={styles.btn} onPress={handleContinue}>
            <Text style={styles.btnText}>Continue →</Text>
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
  },
  eyebrow: sharedStyles.eyebrow,
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    marginBottom: scaleSize(6),
  },
  hint: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: 'rgba(0,0,0,0.35)',
    fontWeight: '400',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: scaleSize(240),
    backgroundColor: ACCENT_BLUE_TINT,
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(24),
  },
  stepBtn: {
    padding: scaleSize(4),
  },
  symbol: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(28),
    fontWeight: '500',
    color: DEEP_BLACK,
    lineHeight: scaleFont(32),
  },
  gpaText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(42),
    fontWeight: '700',
    color: DEEP_BLACK,
    minWidth: scaleSize(80),
    textAlign: 'center',
    letterSpacing: -1,
  },
  footer: {
    paddingTop: scaleSize(12),
  },
  btn: sharedStyles.continueBtn,
  btnText: sharedStyles.continueBtnText,
});
