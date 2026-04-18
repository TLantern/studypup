import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleFont, scaleSize, RESPONSIVE, SCREEN_WIDTH } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { OnboardingView } from '@/components/OnboardingView';

const IS_IPAD = SCREEN_WIDTH >= 768;

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const OPTIONS = [
  { id: '10-20', label: '10-20 min', icon: 'time-outline' as const },
  { id: '20-40', label: '20-40 min', icon: 'book-outline' as const },
  { id: '40-60', label: '40-60 min', icon: 'bulb-outline' as const },
  { id: '60+', label: '60+ min', icon: 'flame-outline' as const },
];

export default function StudyDurationScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('onboarding_study_duration');
  }, []);

  return (
    <OnboardingView>
      <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={65} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>How much do you want to study per day?</Text>
        <Text style={styles.subtitle}>You can change this anytime.</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.optionBtn, selected === o.id && styles.optionBtnSelected]}
              onPress={() => setSelected(o.id)}
            >
              <Ionicons name={o.icon} size={RESPONSIVE.iconSmall} color="#000" />
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
            onPress={async () => {
              if (!selected) return;
              await updateOnboarding({ study_duration: selected });
              router.push('/notification-optin');
            }}
            disabled={!selected}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
      </LinearGradient>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: IS_IPAD ? 34 : 28, color: '#000', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: IS_IPAD ? 22 : 18, color: '#000', textAlign: 'center', marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: scaleSize(16) },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(IS_IPAD ? 10 : 12),
    backgroundColor: '#fff',
    borderRadius: scaleSize(IS_IPAD ? 10 : 12),
    paddingVertical: scaleSize(IS_IPAD ? 12 : 14),
    paddingHorizontal: scaleSize(IS_IPAD ? 14 : 16),
    marginBottom: scaleSize(IS_IPAD ? 8 : 10),
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  optionBtnSelected: { borderColor: '#7c3aed', borderWidth: 2 },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  buttons: { marginTop: 'auto', paddingTop: 6, marginBottom: -34 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: IS_IPAD ? 14 : 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: IS_IPAD ? 22 : 24, color: '#fff' },
  continueBtnDisabled: { opacity: 0.6 },
});
