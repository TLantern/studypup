import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, OFF_WHITE, CARD_SHADOW, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';

const OPTIONS = [
  { id: '1-3', label: '1-3 meetings' },
  { id: '4-7', label: '4-7 meetings' },
  { id: '8-12', label: '8-12 meetings' },
  { id: '12+', label: '12+ meetings' },
];

export default function MeetingsPerWeekScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('ob_pro_meetings_per_week');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ meetings_per_week: id });
    router.push('/meeting-notes-method');
  };

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.52} />}>
      <View style={[styles.container, { paddingBottom: insets.bottom + scaleSize(24) }]}>
        <Text style={styles.subtitle}>Personalizing your Notario...</Text>
        <Text style={styles.title}>
          How many meetings are you{' '}
          <Text style={styles.titleEmphasis}>sitting through</Text>
          {' '}each week?
        </Text>

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
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(26),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    marginBottom: scaleSize(8),
    textAlign: 'left',
  },
  titleEmphasis: {
    fontStyle: 'italic',
  },
  subtitle: sharedStyles.eyebrow,
  scroll: { flex: 1 },
  list: { gap: scaleSize(8), paddingBottom: scaleSize(16) },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(8),
    paddingVertical: scaleSize(18),
    paddingHorizontal: scaleSize(20),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...CARD_SHADOW,
  },
  cardSelected: sharedStyles.cardSelected,
  cardPressed: sharedStyles.cardPressed,
  cardText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: DEEP_BLACK,
  },
  cardTextSelected: sharedStyles.cardTextSelected,
});
