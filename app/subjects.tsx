import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEEP_BLACK } from '@/lib/onboarding-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed, trackEvent } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { ACCENT_BLUE, SUBTITLE_GRAY, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { SuperwallAvailableContext } from '@/lib/superwall';

const SUBJECTS = [
  { id: 'biology', label: 'Biology', emoji: '🧬' },
  { id: 'cs', label: 'Computer Science', emoji: '💻' },
  { id: 'math', label: 'Math', emoji: '➗' },
  { id: 'history', label: 'History', emoji: '🏛️' },
  { id: 'geography', label: 'Geography', emoji: '🌍' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'chemistry', label: 'Chemistry', emoji: '🧪' },
  { id: 'religious', label: 'Religious Studies', emoji: '🙏' },
];

export default function SubjectsScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const superwallAvailable = useContext(SuperwallAvailableContext);

  useEffect(() => {
    trackPageViewed('ob_student_subjects');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ subjects: [id] });
    trackEvent('ob_student_subject_selected', { subject: id });
    router.push('/students-improve');
  };

  const handleSkip = () => {
    hapticSelect();
    trackEvent('ob_student_subjects_skipped');
    if (superwallAvailable) {
      router.push('/paywall');
    } else {
      router.replace('/create-account');
    }
  };

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: 0 }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '28%' }]} />
          </View>
        </View>

        <Text style={styles.title}>Which subject are you struggling with most?</Text>
        <Text style={styles.subtitle}>Pick your biggest challenge right now.</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {SUBJECTS.map((s) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [
                styles.card,
                selected === s.id && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(s.id)}
            >
              <Text style={[styles.cardText, selected === s.id && styles.cardTextSelected]}>{s.label}</Text>
              <Text style={styles.cardEmoji}>{s.emoji}</Text>
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
  cardEmoji: { fontSize: scaleFont(20) },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleSize(36), gap: scaleSize(8) },
  progressTrack: { flex: 1, height: 10, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6 },
  backBtn: { padding: scaleSize(4) },
  skipBtn: { alignItems: 'center', paddingTop: scaleSize(8) },
  skipText: { ...sharedStyles.skipText, fontSize: scaleFont(17), textDecorationLine: 'underline' },
});
