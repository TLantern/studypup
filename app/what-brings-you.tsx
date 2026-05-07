import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed, trackEvent } from '@/lib/analytics';
import { hapticContinue, hapticSelect } from '@/lib/haptics';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { SuperwallAvailableContext } from '@/lib/superwall';

const OPTIONS = [
  { id: 'improve_grades', label: 'Improve my grades', emoji: '💯' },
  { id: 'learn_faster', label: 'Learn 10x faster', emoji: '📗' },
  { id: 'focus_lectures', label: 'Focus better in lectures', emoji: '🎙️' },
  { id: 'never_miss', label: 'Never miss a detail in lecture', emoji: '📈' },
  { id: 'something_else', label: 'Something else', emoji: '✍️' },
];

export default function WhatBringsYouScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const superwallAvailable = useContext(SuperwallAvailableContext);

  useEffect(() => {
    trackPageViewed('ob_what_brings_you');
  }, []);

  const toggle = (id: string) => {
    hapticSelect();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = async () => {
    hapticContinue();
    const goals = Array.from(selected);
    await updateOnboarding({ goals });
    trackEvent('ob_what_brings_you_selected', { goals });
    router.push('/current-gpa');
  };

  const handleSkip = () => {
    hapticSelect();
    trackEvent('ob_what_brings_you_skipped');
    if (superwallAvailable) router.push('/paywall');
    else router.replace('/create-account');
  };

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.42} onSkip={handleSkip} />}>
      <View style={[styles.container, { paddingBottom: 0 }]}>
        <Text style={styles.subtitle}>Personalizing your Notario...</Text>
        <Text style={styles.title}>What brings you to Notario?</Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + scaleSize(24), flexGrow: 1, justifyContent: 'flex-end' }]}
          showsVerticalScrollIndicator={false}
        >
          {OPTIONS.map((o) => {
            const isSelected = selected.has(o.id);
            return (
              <Pressable
                key={o.id}
                style={({ pressed }) => [styles.card, isSelected && styles.cardSelected, pressed && styles.cardPressed]}
                onPress={() => toggle(o.id)}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.emojiCircle, isSelected && styles.emojiCircleSelected]}>
                    <Text style={styles.emojiText}>{o.emoji}</Text>
                  </View>
                  <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{o.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + scaleSize(16) }]}>
          <Pressable
            style={[styles.btn, selected.size === 0 && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={selected.size === 0}
          >
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: sharedStyles.container,
  title: { ...sharedStyles.title, textAlign: 'left', paddingBottom: scaleSize(10) },
  subtitle: sharedStyles.eyebrow,
  scroll: { flex: 1 },
  list: { gap: scaleSize(8) },
  footer: {
    paddingTop: scaleSize(12),
  },
  card: {
    backgroundColor: '#F7F7F5',
    borderRadius: scaleSize(14),
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  cardSelected: { borderColor: '#7FA8FF', backgroundColor: '#EEF3FF' },
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
  cardTextSelected: { color: ACCENT_BLUE, fontWeight: '600' },
  btn: sharedStyles.continueBtn,
  btnDisabled: { opacity: 0.4 },
  btnText: sharedStyles.continueBtnText,
});
