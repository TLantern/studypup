import { ProgressBar } from '@/components/ProgressBar';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { RESPONSIVE, scaleSize } from '@/lib/responsive';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_WIDTH } from '@/lib/responsive';

const IS_IPAD = SCREEN_WIDTH >= 768;

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const OPTIONS = [
  { id: 'below-2', label: 'Below 2.0' },
  { id: '2-2.5', label: '2.0 - 2.5' },
  { id: '2.5-3', label: '2.5 - 3.0' },
  { id: '3-3.5', label: '3.0 - 3.5' },
  { id: '3.5+', label: '3.5+' },
  { id: 'unsure', label: "I'm not sure" },
];

export default function CurrentGpaScreen() {
  const insets = useSafeAreaInsets();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('onboarding_current_gpa');
  }, []);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={70} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>What's your current GPA?</Text>
        <Text style={styles.subtitle}>This helps tailor your study plan.</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.optionBtn, selected === o.id && styles.optionBtnSelected]}
              onPress={() => setSelected(o.id)}
            >
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable onPress={() => router.replace(superwallAvailable ? '/paywall' : '/create-account')}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
            onPress={async () => {
              if (!selected) return;
              await updateOnboarding({ current_gpa: selected });
              router.push('/target-gpa');
            }}
            disabled={!selected}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
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
  skipText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#555', textAlign: 'center', textDecorationLine: 'underline', marginBottom: 12 },
});
