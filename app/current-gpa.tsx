import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEEP_BLACK } from '@/lib/onboarding-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { ACCENT_BLUE, sharedStyles } from '@/lib/onboarding-theme';
import { SuperwallAvailableContext } from '@/lib/superwall';

const OPTIONS = [
  { id: 'below-2', label: 'Below 2.0' },
  { id: '2-2.5', label: '2.0 – 2.5' },
  { id: '2.5-3', label: '2.5 – 3.0' },
  { id: '3-3.5', label: '3.0 – 3.5' },
  { id: '3.5+', label: '3.5+' },
  { id: 'unsure', label: "I'm not sure" },
];

export default function CurrentGpaScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);

  useEffect(() => {
    trackPageViewed('ob_student_current_gpa');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ current_gpa: id });
    router.push('/target-gpa');
  };

  const handleSkip = () => {
    hapticSelect();
    if (superwallAvailable) router.push('/paywall');
    else router.replace('/create-account');
  };

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: 0 }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '70%' }]} />
          </View>
        </View>

        <Text style={styles.title}>What's your current GPA?</Text>
        <Text style={styles.subtitle}>This helps tailor your study plan.</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              style={({ pressed }) => [
                styles.card,
                selected === o.id && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(o.id)}
            >
              <Text style={[styles.cardText, selected === o.id && styles.cardTextSelected]}>{o.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={handleSkip} hitSlop={12} style={[styles.skipBtn, { height: insets.bottom + scaleSize(24), justifyContent: 'center' }]}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: sharedStyles.container,
  progressTrack: sharedStyles.progressTrack,
  progressFill: { height: '100%', backgroundColor: ACCENT_BLUE, borderRadius: 6 },
  title: sharedStyles.title,
  subtitle: sharedStyles.subtitle,
  scroll: { flex: 1 },
  list: { gap: scaleSize(12), paddingBottom: scaleSize(16) },
  card: sharedStyles.card,
  cardSelected: sharedStyles.cardSelected,
  cardPressed: sharedStyles.cardPressed,
  cardText: sharedStyles.cardText,
  cardTextSelected: sharedStyles.cardTextSelected,
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleSize(36), gap: scaleSize(8) },
  progressTrack: { flex: 1, height: 10, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6 },
  backBtn: { padding: scaleSize(4) },
  skipBtn: { alignItems: 'center' },
  skipText: { ...sharedStyles.skipText, fontSize: scaleFont(17), textDecorationLine: 'underline' },
});
