import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { updateOnboarding, type UserTag } from '@/lib/onboarding-storage';
import { writeUserTag } from '@/lib/user-profile';
import { scaleFont, scaleSize, scaleVertical, isSmallDevice } from '@/lib/responsive';
import { trackPageViewed, trackEvent, getPostHogClient } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';

const DEEP_BLACK = '#0D0D0F';
const OFF_WHITE = '#F7F7F5';
const ACCENT_BLUE = '#7FA8FF';
const SUBTITLE_GRAY = '#6B7280';

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const STUDENT_IDS = new Set(['undergraduate', 'highschool', 'middleschool', 'graduate', 'educator']);

const ROLES = [
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'undergraduate', label: 'College / University Student', emoji: '🎓' },
  { id: 'highschool', label: 'High School Student', emoji: '📚' },
  { id: 'graduate', label: 'Graduate Student', emoji: '🔬' },
  { id: 'educator', label: 'Educator', emoji: '🍎' },
  { id: 'other', label: 'Something else', emoji: '💡' },
];

export default function GradeLevelScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('ob_shared_user_type');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    const tag: UserTag = STUDENT_IDS.has(id) ? 'student' : 'working-class';
    await updateOnboarding({ grade_level: id, user_tag: tag });
    await writeUserTag(tag);
    const path = tag === 'student' ? 'student' : 'professional';
    trackEvent('ob_user_type_selected', { role: id, path });
    getPostHogClient()?.setPersonProperties({ user_path: path, role: id });
    if (tag === 'student') {
      router.push('/subjects');
    } else {
      router.push('/meeting-review');
    }
  };

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.14} />}>
      <View style={styles.container}>
        <Text style={styles.subtitle}>Personalizing your Notario...</Text>
        <Text style={styles.title}>What describes you best?</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + scaleSize(24), flexGrow: 1, justifyContent: 'flex-end' }]} showsVerticalScrollIndicator={false}>
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            return (
              <Pressable
                key={role.id}
                style={({ pressed }) => [styles.card, isSelected && styles.cardSelected, pressed && styles.cardPressed]}
                onPress={() => handleSelect(role.id)}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.emojiCircle, isSelected && styles.emojiCircleSelected]}>
                    <Text style={styles.emojiText}>{role.emoji}</Text>
                  </View>
                  <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{role.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scaleSize(24),
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleVertical(isSmallDevice ? 20 : 36),
    gap: scaleSize(8),
  },
  backBtn: {
    padding: scaleSize(4),
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    width: '14%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    marginBottom: scaleSize(8),
    paddingBottom: scaleSize(10)
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: ACCENT_BLUE,
    fontWeight: '400',
    marginBottom: scaleSize(2),
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: scaleSize(8),
  },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(14),
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
    width: scaleSize(42),
    height: scaleSize(42),
    borderRadius: scaleSize(21),
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
  emojiText: { fontSize: scaleFont(20) },
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
