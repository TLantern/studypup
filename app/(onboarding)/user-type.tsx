import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
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
  { id: 'undergraduate', label: 'Undergraduate Student', emoji: '🎓' },
  { id: 'highschool', label: 'High School Student', emoji: '📚' },
  { id: 'middleschool', label: 'Middle School Student', emoji: '🎒' },
  { id: 'graduate', label: 'Graduate Student', emoji: '🔬' },
  { id: 'educator', label: 'Educator', emoji: '🍎' },
  { id: 'other', label: 'Other', emoji: '✨' },
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
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleVertical(24), paddingBottom: insets.bottom + scaleVertical(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <Text style={styles.title}>What describes you best?</Text>
        <Text style={styles.subtitle}>Personalizing your Notario...</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {ROLES.map((role) => (
            <Pressable
              key={role.id}
              style={({ pressed }) => [
                styles.card,
                selected === role.id && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(role.id)}
            >
              <Text style={[styles.cardText, selected === role.id && styles.cardTextSelected]}>
                {role.label}
              </Text>
              <Text style={styles.cardEmoji}>{role.emoji}</Text>
            </Pressable>
          ))}
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
    fontSize: scaleFont(26),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    marginBottom: scaleSize(8),
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
    fontWeight: '400',
    marginBottom: scaleVertical(isSmallDevice ? 16 : 28),
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: scaleSize(12),
    paddingBottom: scaleSize(16),
  },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(8),
    paddingVertical: scaleSize(18),
    paddingHorizontal: scaleSize(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 5,
  },
  cardSelected: {
    borderColor: ACCENT_BLUE,
    backgroundColor: '#EEF3FF',
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  cardTextSelected: {
    color: ACCENT_BLUE,
  },
  cardEmoji: {
    fontSize: scaleFont(20),
  },
});
