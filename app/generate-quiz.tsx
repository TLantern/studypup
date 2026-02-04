import { FillInBlankStudy } from '@/components/FillInBlankStudy';
import { FlashcardStudy } from '@/components/FlashcardStudy';
import { NotesStudy } from '@/components/NotesStudy';
import { TutorStudy } from '@/components/TutorStudy';
import { WrittenStudy } from '@/components/WrittenStudy';
import { getMaterials } from '@/lib/study-materials-storage';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const SCAFFOLD_QUIZ = [
  { question: 'What part of the cell is responsible for producing energy?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'], correct_answer_index: 1 },
  { question: 'What process do plants use to convert sunlight into energy?', options: ['Respiration', 'Photosynthesis', 'Fermentation', 'Digestion'], correct_answer_index: 1 },
  { question: 'Which organelle contains DNA?', options: ['Mitochondria', 'Ribosome', 'Nucleus', 'Golgi apparatus'], correct_answer_index: 2 },
  { question: 'Where does protein synthesis occur?', options: ['Nucleus', 'Golgi apparatus', 'Ribosome', 'Vacuole'], correct_answer_index: 2 },
  { question: 'What gas do plants absorb for photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct_answer_index: 2 },
  { question: 'Which structure is known as the "powerhouse" of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Chloroplast'], correct_answer_index: 2 },
  { question: 'Where is chlorophyll found in plant cells?', options: ['Mitochondria', 'Nucleus', 'Chloroplast', 'Vacuole'], correct_answer_index: 2 },
  { question: 'What is the main function of the cell membrane?', options: ['Produce energy', 'Store DNA', 'Control what enters and exits', 'Make proteins'], correct_answer_index: 2 },
  { question: 'Which organelle packages and distributes proteins?', options: ['Ribosome', 'Nucleus', 'Mitochondria', 'Golgi apparatus'], correct_answer_index: 3 },
  { question: 'What do mitochondria produce for the cell?', options: ['Proteins', 'ATP', 'DNA', 'Chlorophyll'], correct_answer_index: 1 },
];

export default function GenerateQuizScreen() {
  const insets = useSafeAreaInsets();
  const { methods, materialId } = useLocalSearchParams<{ methods?: string; materialId?: string }>();
  const selectedIds = (methods ?? 'quiz').split(',').filter(Boolean);
  const tabs = ALL_TABS.filter((t) => selectedIds.includes(t.id));
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'quiz');
  const [materials, setMaterials] = useState<{
    flashcards: { front: string; back: string }[];
    quiz_questions: { question: string; options: string[]; correct_answer_index: number }[];
    written_questions: { question: string; rubric?: string[] }[];
    fill_in_blank_questions: { text: string; answer: string }[];
    notes: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!materialId);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    if (!materialId) {
      setLoading(false);
      return;
    }
    getMaterials(materialId).then((m) => {
      if (m) {
        setMaterials({
          flashcards: m.flashcards.map((f) => ({ front: f.front, back: f.back })),
          quiz_questions: m.quiz_questions.map((q) => ({
            question: q.question,
            options: q.options,
            correct_answer_index: q.correct_answer_index,
          })),
          written_questions: m.written_questions.map((w) => ({
            question: w.question,
            rubric: w.rubric,
          })),
          fill_in_blank_questions: m.fill_in_blank_questions.map((f) => ({
            text: f.text,
            answer: f.answer,
          })),
          notes: m.notes,
        });
      }
      setLoading(false);
    });
  }, [materialId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  const flashcardCards = materials?.flashcards?.map((f) => ({ question: f.front, answer: f.back })) ?? undefined;
  const writtenItems = materials?.written_questions?.map((w) => ({ question: w.question })) ?? undefined;
  const fillItems = materials?.fill_in_blank_questions?.map((f) => ({ text: f.text, answer: f.answer })) ?? undefined;
  const notesContent = materials?.notes ?? undefined;

  const quizQuestions = (materials?.quiz_questions?.length ?? 0) >= 10
    ? materials!.quiz_questions
    : [...(materials?.quiz_questions ?? []), ...SCAFFOLD_QUIZ].slice(0, 10);
  const quizData = quizQuestions[questionIndex] ?? SCAFFOLD_QUIZ[0];
  const correctIndex = quizData.correct_answer_index;
  const answered = selectedAnswer !== null;
  const totalQuestions = quizQuestions.length;

  const getAnswerCardStyle = (i: number) => {
    if (!answered) return [styles.answerCard];
    const isCorrect = i === correctIndex;
    const isChosen = i === selectedAnswer;
    const chosenCorrect = isChosen && isCorrect;
    const chosenWrong = isChosen && !isCorrect;
    const showCorrect = isCorrect && selectedAnswer !== correctIndex;
    const hoverShadow = chosenCorrect || chosenWrong || showCorrect;
    return [
      styles.answerCard,
      (chosenCorrect || showCorrect) && styles.answerCardCorrect,
      chosenWrong && styles.answerCardWrong,
      hoverShadow && styles.answerCardHoverShadow,
    ].filter(Boolean);
  };

  const goNext = () => {
    if (questionIndex >= totalQuestions - 1) {
      router.back();
      return;
    }
    setSelectedAnswer(null);
    setQuestionIndex((i) => i + 1);
  };

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

      {activeTab === 'notes' && <NotesStudy notes={notesContent} />}
      {activeTab === 'tutor' && <TutorStudy notes={notesContent} />}
      {activeTab === 'flashcards' && <FlashcardStudy cards={flashcardCards} />}
      {activeTab === 'written' && <WrittenStudy items={writtenItems} />}
      {activeTab === 'fill' && <FillInBlankStudy items={fillItems} />}
      {activeTab === 'quiz' && (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.question}>{quizData.question}</Text>
            <Text style={styles.questionCounter}>{questionIndex + 1}/{totalQuestions}</Text>
            {quizData.options.map((ans, i) => (
              <Pressable
                key={i}
                style={getAnswerCardStyle(i)}
                onPress={() => !answered && setSelectedAnswer(i)}
                disabled={answered}
              >
                <View style={[styles.answerNum, answered && i === correctIndex && styles.answerNumCorrect]}>
                  <Text style={styles.answerNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.answerText}>{ans}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.nextBtn} onPress={answered ? goNext : undefined} disabled={!answered}>
            <Text style={styles.nextBtnText}>
              {questionIndex < totalQuestions - 1 ? 'Next' : 'Finish'}
            </Text>
          </Pressable>
        </>
      )}
      {!['notes', 'tutor', 'flashcards', 'written', 'fill', 'quiz'].includes(activeTab) && (
        <View style={styles.body}><Text style={styles.question}>Coming soon</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2E4E4', paddingHorizontal: 24 },
  loadingCenter: { justifyContent: 'center', alignItems: 'center' },
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
    marginBottom: 8,
  },
  questionCounter: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#666',
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
  answerCardCorrect: {
    backgroundColor: '#BCFFC0',
    borderWidth: 4,
    borderColor: '#81FF88',
    overflow: 'hidden',
  },
  answerCardWrong: {
    backgroundColor: '#EA898B',
    borderWidth: 4,
    borderColor: '#F5686A',
    overflow: 'hidden',
  },
  answerCardHoverShadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  answerNum: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: SALMON,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerNumCorrect: {
    backgroundColor: '#81FF88',
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
