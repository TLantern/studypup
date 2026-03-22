import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { trackEvent } from '@/lib/mixpanel';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const SUBJECTS = [
  { id: 'biology', label: 'Biology', emoji: '🧬' },
  { id: 'cs', label: 'Computer Science', emoji: '💻' },
  { id: 'math', label: 'Math', emoji: '÷' },
  { id: 'history', label: 'History', emoji: '🏛️' },
  { id: 'geography', label: 'Geography', emoji: '🌍' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'chemistry', label: 'Chemistry', emoji: '🧪' },
  { id: 'religious', label: 'Religious Studies', emoji: '🙏' },
];

export default function SubjectsScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const tracked = useRef(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={30} /></View>
        </View>
        <Text style={[styles.title, { marginTop: scaleSize(24) }]}>Which subjects feel the hardest right now?</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {SUBJECTS.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.subjectBtn, selected.has(s.id) && styles.subjectBtnSelected]}
              onPress={() => toggle(s.id)}
            >
              <Text style={styles.subjectText}>{s.label}</Text>
              <Text style={styles.subjectEmoji}>{s.emoji}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable
            style={[styles.continueBtn, selected.size === 0 && styles.continueBtnDisabled]}
            onPress={async () => {
              if (selected.size === 0) return;
              if (!tracked.current) {
                trackEvent('subjects');
                tracked.current = true;
              }
              await updateOnboarding({ subjects: Array.from(selected) });
              router.push('/students-stats');
            }}
            disabled={selected.size === 0}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  title: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: RESPONSIVE.titleSmall, color: '#000', textAlign: 'center', marginBottom: scaleSize(24) },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: scaleSize(16) },
  subjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(16),
    marginBottom: scaleSize(10),
    borderWidth: 1,
    borderColor: '#ddd',
  },
  subjectBtnSelected: {
    borderColor: '#FD8A8A',
    borderWidth: 2,
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  subjectText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  subjectEmoji: { fontSize: RESPONSIVE.titleSmall },
  buttons: { marginTop: 'auto', paddingTop: scaleSize(6), marginBottom: scaleSize(-34) },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
  continueBtnDisabled: { opacity: 0.6 },
});
