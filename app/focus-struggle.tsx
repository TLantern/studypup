import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { ACCENT_BLUE, DEEP_BLACK, OFF_WHITE, CARD_SHADOW, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticSelect } from '@/lib/haptics';

const OPTIONS = [
  { id: 'very_often', label: 'Very often' },
  { id: 'often', label: 'Often' },
  { id: 'not_often', label: 'Not often' },
];

export default function FocusStruggleScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    trackPageViewed('ob_pro_focus_challenge');
  }, []);

  const handleSelect = async (id: string) => {
    hapticSelect();
    setSelected(id);
    await updateOnboarding({ focus_struggle: id });
    router.push('/meeting-review');
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

        <Text style={styles.title}>How often do you struggle to focus or "zone out" in meetings?</Text>
        <Text style={styles.subtitle}>Personalizing your Notario...</Text>

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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(36),
    gap: scaleSize(8),
  },
  backBtn: { padding: scaleSize(4) },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    width: '72%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  title: { ...sharedStyles.title, fontSize: scaleFont(20) },
  subtitle: sharedStyles.subtitle,
  scroll: { flex: 1 },
  list: { gap: scaleSize(12), paddingBottom: scaleSize(16) },
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
    textAlign: 'center',
  },
  cardTextSelected: sharedStyles.cardTextSelected,
});
