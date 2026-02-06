import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';

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
          <View style={styles.progressWrap}><ProgressBar progress={60} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>Which subjects are you struggling with?</Text>
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
          <Pressable style={styles.continueBtn} onPress={() => router.push('/plan-usage')}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressWrap: { flex: 1 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 24, color: '#000', textAlign: 'center', marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  subjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  subjectBtnSelected: { backgroundColor: '#D4C4B0' },
  subjectText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
  subjectEmoji: { fontSize: 24 },
  buttons: { marginTop: 'auto', paddingTop: 6 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
});
