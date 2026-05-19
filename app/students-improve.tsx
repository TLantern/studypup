// TEMPORARILY COMMENTED OUT — students-improve screen disabled
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function StudentsImproveScreen() {
  useEffect(() => {
    router.replace('/current-gpa');
  }, []);
  return null;
}

/*
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue, hapticSelect } from '@/lib/haptics';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { getOnboarding } from '@/lib/onboarding-storage';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { scaleFont, scaleSize, scaleVertical } from '@/lib/responsive';

const SUBJECT_LABELS: Record<string, string> = {
  biology: 'Biology',
  cs: 'Computer Science',
  math: 'Math',
  history: 'History',
  geography: 'Geography',
  music: 'Music',
  chemistry: 'Chemistry',
  religious: 'Religious Studies',
};

const COUNTS = ['5,000', '6,200', '7,500', '8,100', '9,300', '10,000'];
const randomCount = () => COUNTS[Math.floor(Math.random() * COUNTS.length)];

const FEATURES = [
  'Take detailed lecture notes',
  'Make AI practice exams',
  'Get detailed transcripts',
  'Chat with long PDFs & docs',
];

export default function StudentsImproveScreen() {
  const insets = useSafeAreaInsets();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [subject, setSubject] = useState('students');
  const [count, setCount] = useState('10,000');

  useEffect(() => {
    trackPageViewed('ob_student_social_proof');
    getOnboarding().then(({ subjects }) => {
      const label = subjects?.[0] ? SUBJECT_LABELS[subjects[0]] ?? subjects[0] : null;
      if (label) setSubject(`${label} students`);
      setCount(randomCount());
    });
  }, []);

  const handleSkip = () => {
    hapticSelect();
    if (superwallAvailable) router.push('/paywall');
    else router.replace('/create-account');
  };

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.42} />}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + scaleSize(24) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>You're in good company!</Text>
          <Text style={styles.subtitle}>
            {'We have '}
            <Text style={styles.highlightCount}>{count} </Text>
            <Text style={styles.highlight}>{subject}</Text>
            {' using Notario to:'}
          </Text>

          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark-sharp" size={scaleSize(28)} color="#4CAF50" />
                </View>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + scaleSize(16) }]}>
          <Pressable style={styles.btn} onPress={() => { hapticContinue(); router.push('/current-gpa'); }}>
            <Text style={styles.btnText}>Continue</Text>
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
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: scaleSize(24),
    gap: scaleSize(0),
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(26),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: scaleSize(14),
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    color: DEEP_BLACK,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: scaleFont(24),
    marginBottom: scaleSize(36),
  },
  highlight: {
    color: ACCENT_BLUE,
    fontWeight: '600',
  },
  highlightCount: {
    color: DEEP_BLACK,
    fontWeight: '400',
  },
  featureList: {
    gap: scaleSize(20),
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(16),
  },
  checkCircle: {
    width: scaleSize(48),
    height: scaleSize(48),
    borderRadius: scaleSize(24),
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  featureText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '500',
    color: DEEP_BLACK,
    flex: 1,
  },
  footer: {
    paddingHorizontal: scaleSize(24),
    paddingTop: scaleSize(12),
  },
  btn: sharedStyles.continueBtn,
  btnText: sharedStyles.continueBtnText,
});
*/
