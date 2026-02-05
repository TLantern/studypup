import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

const OPTIONS = [
  { id: 'recording', label: 'Recording Lectures', icon: 'mic' as const },
  { id: 'notes', label: 'Generating Notes', icon: 'document-text' as const },
  { id: 'flashcards', label: 'Flashcards', icon: 'layers' as const },
  { id: 'quizzes', label: 'Quizzes', icon: 'locate' as const },
  { id: 'answers', label: 'Getting Instant Answers', icon: 'flash' as const },
  { id: 'other', label: 'Other', icon: 'help-circle' as const },
];

export default function PlanUsageScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('recording');

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={80} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>How do you plan on using Studypup?</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.optionBtn, selected === o.id && styles.optionBtnSelected]}
              onPress={() => setSelected(o.id)}
            >
              <Text style={styles.optionText}>{o.label}</Text>
              <Ionicons name={o.icon} size={24} color={selected === o.id ? '#7c3aed' : '#666'} />
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.bottomSection}>
          <Image source={require('../assets/buttonpup.png')} style={styles.puppy} contentFit="contain" />
          <Pressable style={styles.continueBtn} onPress={() => router.push('/paywall')}>
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
  optionBtn: {
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
  optionBtnSelected: { borderColor: '#7c3aed', borderWidth: 2 },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
  bottomSection: { marginTop: 'auto', paddingTop: 16, position: 'relative', alignItems: 'center' },
  puppy: { position: 'absolute', bottom: 51, width: 140, height: 120, zIndex: 1 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
});
