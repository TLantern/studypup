import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEEP_BLACK } from '@/lib/onboarding-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { setItem as storageSetItem } from '@/lib/storage';
import { ensureUserDoc } from '@/lib/user-profile';
import { useAuth } from '@/lib/auth-store';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect, hapticContinue } from '@/lib/haptics';
import { ACCENT_BLUE, sharedStyles } from '@/lib/onboarding-theme';

const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';

const OPTIONS = [
  { id: 'recording', label: 'Recording Lectures', subtext: 'Capture every word without the stress', emoji: '🎙️' },
  { id: 'notes', label: 'Generating Notes', subtext: 'Turn recordings into clean, organized notes', emoji: '📝' },
  { id: 'flashcards', label: 'Flashcards', subtext: 'Study smarter with auto-generated cards', emoji: '🃏' },
  { id: 'quizzes', label: 'Quizzes', subtext: 'Test yourself and lock in what you learned', emoji: '🧠' },
  { id: 'answers', label: 'Getting Instant Answers', subtext: 'Ask questions about your material anytime', emoji: '⚡' },
  { id: 'other', label: 'Other', subtext: 'Something else entirely', emoji: '✨' },
];

export default function PlanUsageScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    trackPageViewed('ob_student_plan_frequency');
  }, []);

  const toggleSelect = (id: string) => {
    hapticSelect();
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    hapticContinue();
    await updateOnboarding({ plan_usage: selected });
    await storageSetItem(ONBOARDING_COMPLETE_KEY, 'true');
    if (user) await ensureUserDoc(user).catch((e) => console.error('Failed to save onboarding to Firebase:', e));
    router.push('/creating-plan');
  };

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '92%' }]} />
          </View>
        </View>

        <Text style={styles.title}>How do you plan on using Notario?</Text>
        <Text style={styles.subtitle}>Select all that apply</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => {
            const isSelected = selected.includes(o.id);
            return (
              <Pressable
                key={o.id}
                style={({ pressed }) => [
                  styles.card,
                  isSelected && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => toggleSelect(o.id)}
              >
                <View style={styles.cardContent}>
                  <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{o.label}</Text>
                  <Text style={[styles.cardSubtext, isSelected && styles.cardSubtextSelected]}>{o.subtext}</Text>
                </View>
                <Text style={styles.cardEmoji}>{o.emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={[sharedStyles.continueBtn, selected.length === 0 && sharedStyles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={selected.length === 0}
        >
          <Text style={sharedStyles.continueBtnText}>Continue</Text>
        </Pressable>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: sharedStyles.container,
  progressTrack: { flex: 1, height: 10, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6 },
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
  backBtn: { padding: scaleSize(4) },
  cardContent: { flex: 1, gap: scaleSize(2) },
  cardSubtext: {
    fontFamily: 'SF Pro Text',
    fontSize: scaleFont(12),
    color: '#888',
    fontWeight: '400',
  },
  cardSubtextSelected: {
    color: ACCENT_BLUE,
    opacity: 0.8,
  },
});
