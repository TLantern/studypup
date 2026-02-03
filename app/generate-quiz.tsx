import { FillInBlankStudy } from '@/components/FillInBlankStudy';
import { FlashcardStudy } from '@/components/FlashcardStudy';
import { WrittenStudy } from '@/components/WrittenStudy';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SALMON = '#FD8A8A';
const PURPLE = '#7c3aed';

const ALL_TABS = [
  { id: 'notes', label: 'Notes', icon: require('../assets/icons/notesicon.png') },
  { id: 'flashcards', label: 'Flashcard', icon: require('../assets/icons/flashcardicon.png') },
  { id: 'quiz', label: 'Quiz', icon: require('../assets/icons/quizicon.png') },
  { id: 'written', label: 'Written', icon: require('../assets/icons/pencilicon.png') },
  { id: 'fill', label: 'Fill in the blank', icon: require('../assets/icons/fillicon.png') },
  { id: 'tutor', label: 'Tutor', icon: require('../assets/icons/teachericon.png') },
];

const SCAFFOLD_ANSWERS = ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'];

export default function GenerateQuizScreen() {
  const insets = useSafeAreaInsets();
  const { methods } = useLocalSearchParams<{ methods?: string }>();
  const selectedIds = (methods ?? 'quiz').split(',').filter(Boolean);
  const tabs = ALL_TABS.filter((t) => selectedIds.includes(t.id));
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'quiz');

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.title}>Title</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {tabs.map((t) => (
          <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={[styles.tab, activeTab === t.id && styles.tabActive]}>
            <Image source={t.icon} style={styles.tabIcon} />
            <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeTab === 'flashcards' && <FlashcardStudy />}
      {activeTab === 'written' && <WrittenStudy />}
      {activeTab === 'fill' && <FillInBlankStudy />}
      {activeTab === 'quiz' && (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.question}>
              What part of the cell is responsible for producing energy?
            </Text>
            {SCAFFOLD_ANSWERS.map((ans, i) => (
              <Pressable key={i} style={styles.answerCard}>
                <View style={styles.answerNum}>
                  <Text style={styles.answerNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.answerText}>{ans}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        </>
      )}
      {!['flashcards', 'written', 'fill', 'quiz'].includes(activeTab) && (
        <View style={styles.body}><Text style={styles.question}>Coming soon</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2E4E4', paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
  },
  tabs: { marginBottom: 24, flexGrow: 0, flexShrink: 0 },
  tabsContent: { gap: 8, paddingRight: 24 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tabActive: {
    borderColor: PURPLE,
    borderWidth: 2,
  },
  tabIcon: { width: 20, height: 20 },
  tabLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#666',
  },
  tabLabelActive: { color: '#333' },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 24 },
  question: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  answerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    gap: 12,
  },
  answerNum: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: SALMON,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerNumText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#fff',
  },
  answerText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
  },
  nextBtn: {
    backgroundColor: SALMON,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  nextBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#fff',
  },
});
