import { ProgressBar } from '@/components/ProgressBar';
import { getOnboarding, updateOnboarding } from '@/lib/onboarding-storage';
import { RESPONSIVE, scaleSize } from '@/lib/responsive';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const OPTIONS = [
  { id: '2.5+', label: '2.5+', value: 2.5 },
  { id: '3.0+', label: '3.0+', value: 3.0 },
  { id: '3.5+', label: '3.5+', value: 3.5 },
  { id: '4.0',  label: '4.0',  value: 4.0 },
  { id: 'unsure', label: 'Not sure yet', value: Infinity },
];

const CURRENT_GPA_UPPER: Record<string, number> = {
  'below-2': 1.9,
  '2-2.5':   2.5,
  '2.5-3':   3.0,
  '3-3.5':   3.5,
  '3.5+':    4.0,
  'unsure':  0,
};

export default function TargetGpaScreen() {
  const insets = useSafeAreaInsets();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [selected, setSelected] = useState<string | null>(null);
  const [currentUpper, setCurrentUpper] = useState(0);

  useEffect(() => {
    getOnboarding().then(({ current_gpa }) => {
      if (current_gpa) setCurrentUpper(CURRENT_GPA_UPPER[current_gpa] ?? 0);
    });
  }, []);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={60} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>What GPA do you want to work toward?</Text>
        <Text style={styles.subtitle}>Progress matters more than perfection.</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => {
            const greyed = o.value <= currentUpper;
            return (
              <Pressable
                key={o.id}
                style={[styles.optionBtn, selected === o.id && styles.optionBtnSelected, greyed && styles.optionBtnGreyed]}
                onPress={() => !greyed && setSelected(o.id)}
                disabled={greyed}
              >
                <Text style={[styles.optionText, greyed && styles.optionTextGreyed]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable onPress={() => router.replace(superwallAvailable ? '/paywall' : '/create-account')}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
            onPress={async () => {
              if (!selected) return;
              await updateOnboarding({ target_gpa: selected });
              router.push('/plan-preview');
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
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: RESPONSIVE.titleSmall, color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000', textAlign: 'center', marginBottom: scaleSize(24) },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: scaleSize(16) },
  optionBtn: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(16),
    marginBottom: scaleSize(10),
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  optionBtnSelected: { borderColor: '#FD8A8A', borderWidth: 2 },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  optionBtnGreyed: { opacity: 0.35 },
  optionTextGreyed: { color: '#888' },
  buttons: { marginTop: 'auto', paddingTop: scaleSize(6), marginBottom: scaleSize(-34) },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
  continueBtnDisabled: { opacity: 0.6 },
  skipText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#555', textAlign: 'center', textDecorationLine: 'underline', marginBottom: scaleSize(12) },
});
