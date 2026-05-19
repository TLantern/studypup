import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed, trackEvent } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';
import { sharedStyles, ACCENT_BLUE, SF_PRO, DEEP_BLACK, SCREEN_PADDING, OFF_WHITE } from '@/lib/onboarding-theme';

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

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.28} />}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + scaleSize(24) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>Personalizing your Notario...</Text>
          <Text style={styles.title}>What is your major or primary area of study?</Text>
          {SUBJECTS.map((s) => {
            const isSelected = selected === s.id;
            return (
              <Pressable
                key={s.id}
                style={({ pressed }) => [styles.card, isSelected && styles.cardSelected, pressed && styles.cardPressed]}
                onPress={() => handleSelect(s.id)}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.emojiCircle, isSelected && styles.emojiCircleSelected]}>
                    <Text style={styles.emojiText}>{s.emoji}</Text>
                  </View>
                  <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{s.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </OnboardingView>
  );
}

const CARD_RADIUS = scaleSize(14);
const EMOJI_SIZE = scaleSize(42);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  title: { ...sharedStyles.title, textAlign: 'left', paddingBottom: scaleSize(6) },
  subtitle: { ...sharedStyles.eyebrow, marginBottom: scaleSize(-2) },
  scroll: { flex: 1 },
  list: { gap: scaleSize(8) },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: CARD_RADIUS,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: ACCENT_BLUE,
    backgroundColor: '#EEF3FF',
  },
  cardPressed: { opacity: 0.72 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleSize(7),
    paddingHorizontal: scaleSize(14),
    gap: scaleSize(14),
  },
  emojiCircle: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    borderRadius: EMOJI_SIZE / 2,
    backgroundColor: 'rgba(127,168,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(127,168,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCircleSelected: {
    backgroundColor: 'rgba(127,168,255,0.18)',
    borderColor: 'rgba(127,168,255,0.35)',
  },
  emojiText: {
    fontSize: scaleFont(20),
  },
  cardText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: DEEP_BLACK,
    flex: 1,
  },
  cardTextSelected: {
    color: ACCENT_BLUE,
    fontWeight: '600',
  },
});
