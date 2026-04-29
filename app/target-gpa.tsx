import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEEP_BLACK } from '@/lib/onboarding-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleSize } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { ACCENT_BLUE, sharedStyles } from '@/lib/onboarding-theme';

const OPTIONS = [
  { id: '2.5+', label: '2.5+' },
  { id: '3.0+', label: '3.0+' },
  { id: '3.5+', label: '3.5+' },
  { id: '4.0', label: '4.0' },
  { id: 'unsure', label: 'Not sure yet' },
];

export default function TargetGpaScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('ob_student_target_gpa');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ target_gpa: id });
    router.push('/plan-usage');
  };

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '84%' }]} />
          </View>
        </View>

        <Text style={styles.title}>What GPA do you want to work toward?</Text>
        <Text style={styles.subtitle}>Progress matters more than perfection.</Text>

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
});
