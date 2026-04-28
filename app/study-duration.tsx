import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEEP_BLACK } from '@/lib/onboarding-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { ACCENT_BLUE, sharedStyles } from '@/lib/onboarding-theme';

const OPTIONS = [
  { id: '10-20', label: '10–20 min', emoji: '🌱' },
  { id: '20-40', label: '20–40 min', emoji: '📖' },
  { id: '40-60', label: '40–60 min', emoji: '💡' },
  { id: '60+', label: '60+ min', emoji: '🔥' },
];

export default function StudyDurationScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('ob_student_study_duration');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ study_duration: id });
    router.push('/notification-optin');
  };

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '42%' }]} />
          </View>
        </View>

        <Text style={styles.title}>How much do you want to study per day?</Text>
        <Text style={styles.subtitle}>You can change this anytime.</Text>

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
              <Text style={styles.cardEmoji}>{o.emoji}</Text>
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
  cardEmoji: { fontSize: scaleFont(20) },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleSize(36), gap: scaleSize(8) },
  progressTrack: { flex: 1, height: 10, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6 },
  backBtn: { padding: scaleSize(4) },
});
