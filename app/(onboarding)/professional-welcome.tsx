import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleFont, scaleSize } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';

const DEEP_BLACK = '#0D0D0F';
const OFF_WHITE = '#F7F7F5';
const ACCENT_BLUE = '#7FA8FF';
const SUBTITLE_GRAY = '#6B7280';

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const WORK_TYPES = [
  { id: 'business_owner', label: 'Business Owner', emoji: '🏢' },
  { id: 'creative_media', label: 'Creative / Media', emoji: '🎨' },
  { id: 'education', label: 'Education', emoji: '🍎' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'legal', label: 'Legal', emoji: '⚖️' },
  { id: 'manager_executive', label: 'Manager / Executive', emoji: '📊' },
  { id: 'sales_marketing', label: 'Sales / Marketing', emoji: '📣' },
  { id: 'skilled_trades', label: 'Skilled Trades', emoji: '🔧' },
  { id: 'tech_it', label: 'Tech / IT', emoji: '💻' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export default function ProfessionalWorkScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('ob_pro_work_type');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ work_type: id });
    router.push('/social-proof');
  };

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <Text style={styles.title}>What describes your work?</Text>
        <Text style={styles.subtitle}>Personalizing your Notario...</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {WORK_TYPES.map((type) => (
            <Pressable
              key={type.id}
              style={({ pressed }) => [
                styles.card,
                selected === type.id && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelect(type.id)}
            >
              <Text style={[styles.cardText, selected === type.id && styles.cardTextSelected]}>
                {type.label}
              </Text>
              <Text style={styles.cardEmoji}>{type.emoji}</Text>
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
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    width: '28%',
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
    marginBottom: scaleSize(28),
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: scaleSize(12),
    paddingBottom: scaleSize(16),
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(36),
    gap: scaleSize(8),
  },
  backBtn: {
    padding: scaleSize(4),
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
  cardEmoji: {
    fontSize: scaleFont(20),
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
});
