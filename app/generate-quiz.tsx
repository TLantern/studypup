import { GeneratingContentScreen } from '@/components/GeneratingContentScreen';
import { FillInBlankStudy } from '@/components/FillInBlankStudy';
import { FlashcardStudy } from '@/components/FlashcardStudy';
import { NotesStudy } from '@/components/NotesStudy';
import { TutorStudy } from '@/components/TutorStudy';
import { WrittenStudy } from '@/components/WrittenStudy';
import { getMaterials, updateMaterials } from '@/lib/study-materials-storage';
import { getKnowledgeGraph } from '@/lib/knowledge-graph-storage';
import {
  generateFlashcardsWithAI,
  generateNotesWithAI,
  generateQuizQuestionsWithAI,
  generateWrittenQuestionsWithAI,
  generateFillInBlankQuestionsWithAI,
  reviseNotesWithAI,
} from '@/lib/ai-material-generation';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

const methodsKey = (methods?: string) => methods ?? 'quiz';

export default function GenerateQuizScreen() {
  const insets = useSafeAreaInsets();
  const { methods, materialId } = useLocalSearchParams<{ methods?: string; materialId?: string }>();
  const methodsStr = methodsKey(methods);
  const selectedIds = useMemo(() => methodsStr.split(',').filter(Boolean), [methodsStr]);
  const tabs = ALL_TABS.filter((t) => selectedIds.includes(t.id));
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'quiz');
  const [title, setTitle] = useState('Title');
  const [materials, setMaterials] = useState<{
    flashcards: { id: string; front: string; back: string }[];
    quiz_questions: { id: string; question: string; options: string[]; correct_answer_index: number }[];
    written_questions: { id: string; question: string; rubric?: string[] }[];
    fill_in_blank_questions: { id: string; text: string; answer: string }[];
    notes: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!materialId);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sessionQuizCorrect, setSessionQuizCorrect] = useState(0);
  const [flashcardCorrect, setFlashcardCorrect] = useState(0);
  const [flashcardTotal, setFlashcardTotal] = useState(0);
  const [writtenCorrect, setWrittenCorrect] = useState(0);
  const [writtenTotal, setWrittenTotal] = useState(0);
  const [fillCorrect, setFillCorrect] = useState(0);
  const [fillTotal, setFillTotal] = useState(0);
  const [generatingMessage, setGeneratingMessage] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [flashcardAnswers, setFlashcardAnswers] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, { answer: string; correct: boolean; explanation?: string }>>({});
  const [fillAnswers, setFillAnswers] = useState<Record<string, { answer: string; correct: boolean; explanation?: string }>>({});
  const [editNoteModalVisible, setEditNoteModalVisible] = useState(false);
  const [editNoteInstruction, setEditNoteInstruction] = useState('');
  const [notesRegenerating, setNotesRegenerating] = useState(false);

  useEffect(() => {
    if (!materialId) {
      setLoading(false);
      return;
    }
    
    const loadAndGenerate = async () => {
      const m = await getMaterials(materialId);
      if (!m) {
        setLoading(false);
        return;
      }

      setTitle(m.title ?? 'Title');

      // Check which content is missing for the selected methods
      const needsFlashcards = selectedIds.includes('flashcards') && (!m.flashcards || m.flashcards.length === 0);
      const needsQuiz = selectedIds.includes('quiz') && (!m.quiz_questions || m.quiz_questions.length === 0);
      const needsWritten = selectedIds.includes('written') && (!m.written_questions || m.written_questions.length === 0);
      const needsFill = selectedIds.includes('fill') && (!m.fill_in_blank_questions || m.fill_in_blank_questions.length === 0);

      // If any content needs generation, get the knowledge graph and generate
      if (needsFlashcards || needsQuiz || needsWritten || needsFill) {
        try {
          setGeneratingMessage('Loading knowledge graph...');
          const graph = await getKnowledgeGraph(m.knowledge_graph_id);
          if (graph) {
            const updates: any = {};

            if (needsFlashcards) {
              setGeneratingMessage('Generating flashcards...');
              const flashcards = await generateFlashcardsWithAI(graph, 10);
              updates.flashcards = flashcards;
            }
            if (needsQuiz) {
              setGeneratingMessage('Generating quiz questions...');
              const quizzes = await generateQuizQuestionsWithAI(graph, 10);
              updates.quiz_questions = quizzes;
            }
            if (needsWritten) {
              setGeneratingMessage('Generating written questions...');
              const written = await generateWrittenQuestionsWithAI(graph, 5);
              updates.written_questions = written;
            }
            if (needsFill) {
              setGeneratingMessage('Generating fill in the blank...');
              const fill = await generateFillInBlankQuestionsWithAI(graph, 10);
              updates.fill_in_blank_questions = fill;
            }

            // Update the materials with newly generated content
            await updateMaterials(materialId, updates);
            
            // Reload to get the updated materials
            const updated = await getMaterials(materialId);
            if (updated) {
              setMaterials({
                flashcards: updated.flashcards.map((f) => ({ id: f.id, front: f.front, back: f.back })),
                quiz_questions: updated.quiz_questions.map((q) => ({
                  id: q.id,
                  question: q.question,
                  options: q.options,
                  correct_answer_index: q.correct_answer_index,
                })),
                written_questions: updated.written_questions.map((w) => ({
                  id: w.id,
                  question: w.question,
                  rubric: w.rubric,
                })),
                fill_in_blank_questions: updated.fill_in_blank_questions.map((f) => ({
                  id: f.id,
                  text: f.text,
                  answer: f.answer,
                })),
                notes: updated.notes,
              });
              setQuizAnswers(updated.user_answers?.quiz_questions ?? {});
              setFlashcardAnswers(updated.user_answers?.flashcards ?? {});
              setWrittenAnswers(updated.user_answers?.written_questions ?? {});
              setFillAnswers(updated.user_answers?.fill_in_blank_questions ?? {});
              setFlashcardCorrect(updated.progress?.flashcards ?? 0);
              setFlashcardTotal(updated.flashcards?.length ?? 0);
              setWrittenCorrect(updated.progress?.written ?? 0);
              setWrittenTotal(updated.written_questions?.length ?? 0);
              setFillCorrect(updated.progress?.fillInBlanks ?? 0);
              setFillTotal(updated.fill_in_blank_questions?.length ?? 0);
              const qa = updated.user_answers?.quiz_questions ?? {};
              const qq = updated.quiz_questions ?? [];
              const sessionCorrect = qq.filter((q) => qa[q.id] === q.correct_answer_index).length;
              setSessionQuizCorrect(sessionCorrect);
            }
          }
        } catch (error) {
          console.error('Failed to generate missing content:', error);
        }
      } else {
        // No generation needed, just load existing content
        setMaterials({
          flashcards: m.flashcards.map((f) => ({ id: f.id, front: f.front, back: f.back })),
          quiz_questions: m.quiz_questions.map((q) => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correct_answer_index: q.correct_answer_index,
          })),
          written_questions: m.written_questions.map((w) => ({
            id: w.id,
            question: w.question,
            rubric: w.rubric,
          })),
          fill_in_blank_questions: m.fill_in_blank_questions.map((f) => ({
            id: f.id,
            text: f.text,
            answer: f.answer,
          })),
          notes: m.notes,
        });
        setQuizAnswers(m.user_answers?.quiz_questions ?? {});
        setFlashcardAnswers(m.user_answers?.flashcards ?? {});
        setWrittenAnswers(m.user_answers?.written_questions ?? {});
        setFillAnswers(m.user_answers?.fill_in_blank_questions ?? {});
        setFlashcardCorrect(m.progress?.flashcards ?? 0);
        setFlashcardTotal(m.flashcards?.length ?? 0);
        setWrittenCorrect(m.progress?.written ?? 0);
        setWrittenTotal(m.written_questions?.length ?? 0);
        setFillCorrect(m.progress?.fillInBlanks ?? 0);
        setFillTotal(m.fill_in_blank_questions?.length ?? 0);
        const qa = m.user_answers?.quiz_questions ?? {};
        const qq = m.quiz_questions ?? [];
        setSessionQuizCorrect(qq.filter((q) => qa[q.id] === q.correct_answer_index).length);
      }

      setLoading(false);
    };

    loadAndGenerate();
  }, [materialId, methodsStr]);

  // Sync selected answer when question index or saved answers change (must run every render for Rules of Hooks)
  useEffect(() => {
    if (!materials?.quiz_questions?.length) {
      setSelectedAnswer(null);
      return;
    }
    const quizQuestions = materials.quiz_questions.length >= 10
      ? materials.quiz_questions
      : [...materials.quiz_questions, ...SCAFFOLD_QUIZ.map((q, i) => ({ id: `scaffold_${i}`, ...q }))].slice(0, 10);
    const quizData = quizQuestions[questionIndex] ?? quizQuestions[0];
    if (quizData?.id && quizAnswers[quizData.id] !== undefined) {
      setSelectedAnswer(quizAnswers[quizData.id]);
    } else {
      setSelectedAnswer(null);
    }
  }, [materials, questionIndex, quizAnswers]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingCenter, { backgroundColor: '#f8fafc' }]}>
        <GeneratingContentScreen contentTypes={selectedIds} />
      </View>
    );
  }

  const flashcardCards = materials?.flashcards?.map((f) => ({ id: f.id, question: f.front, answer: f.back })) ?? undefined;

  const handleFlashcardProgress = (correct: number, total: number) => {
    setFlashcardCorrect(correct);
    setFlashcardTotal(total);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            progress: { ...m.progress, flashcards: correct },
          });
        }
      });
    }
  };

  const handleFlashcardAnswersUpdate = (answers: Record<string, 'correct' | 'incorrect'>) => {
    setFlashcardAnswers(answers);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, flashcards: answers },
          });
        }
      });
    }
  };

  const handleWrittenProgress = (correct: number, total: number) => {
    setWrittenCorrect(correct);
    setWrittenTotal(total);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            progress: { ...m.progress, written: correct },
          });
        }
      });
    }
  };

  const handleWrittenAnswersUpdate = (answers: Record<string, { answer: string; correct: boolean; explanation?: string }>) => {
    setWrittenAnswers(answers);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, written_questions: answers },
          });
        }
      });
    }
  };

  const handleFillProgress = (correct: number, total: number) => {
    setFillCorrect(correct);
    setFillTotal(total);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            progress: { ...m.progress, fillInBlanks: correct },
          });
        }
      });
    }
  };

  const handleFillAnswersUpdate = (answers: Record<string, { answer: string; correct: boolean; explanation?: string }>) => {
    setFillAnswers(answers);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, fill_in_blank_questions: answers },
          });
        }
      });
    }
  };

  const writtenItems = materials?.written_questions?.map((w) => ({ id: w.id, question: w.question })) ?? undefined;
  const fillItems = materials?.fill_in_blank_questions?.map((f) => ({ id: f.id, text: f.text, answer: f.answer })) ?? undefined;
  const notesContent = materials?.notes ?? undefined;

  const quizQuestions = (materials?.quiz_questions?.length ?? 0) >= 10
    ? materials!.quiz_questions
    : [...(materials?.quiz_questions ?? []), ...SCAFFOLD_QUIZ.map((q, i) => ({ id: `scaffold_${i}`, ...q }))].slice(0, 10);
  const quizData = quizQuestions[questionIndex] ?? { id: 'scaffold_0', ...SCAFFOLD_QUIZ[0] };
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
    const correctThis = answered && selectedAnswer === correctIndex ? 1 : 0;
    const newCorrect = sessionQuizCorrect + correctThis;
    
    // Save the answer
    if (answered && materialId && quizData.id) {
      const updatedAnswers = { ...quizAnswers, [quizData.id]: selectedAnswer };
      setQuizAnswers(updatedAnswers);
      getMaterials(materialId).then((m) => {
        if (m) {
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, quiz_questions: updatedAnswers },
            progress: { ...m.progress, multipleChoice: newCorrect },
          });
        }
      });
    }
    
    if (questionIndex >= totalQuestions - 1) {
      router.back();
      return;
    }
    setSessionQuizCorrect(newCorrect);
    setSelectedAnswer(null);
    setQuestionIndex((i) => i + 1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={28} color="#333" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
        {tabs.map((t) => (
          <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={[styles.tab, activeTab === t.id && styles.tabActive]}>
            <Image source={t.icon} style={styles.tabIcon} />
            <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.divider} />

      {activeTab === 'notes' && (
        <View style={styles.notesTabWrap}>
          {notesContent?.trim() ? (
            <Pressable
              style={styles.editNoteBtn}
              onPress={() => setEditNoteModalVisible(true)}
              disabled={notesRegenerating}
            >
              <Image source={require('../assets/icons/notesicon.png')} style={styles.editNoteIcon} />
              <Text style={styles.editNoteLabel}>Edit note</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.generateNotesBtn}
              onPress={async () => {
                if (!materialId || notesRegenerating) return;
                setNotesRegenerating(true);
                try {
                  const m = await getMaterials(materialId);
                  if (!m?.knowledge_graph_id) throw new Error('No material or knowledge graph');
                  const graph = await getKnowledgeGraph(m.knowledge_graph_id);
                  if (!graph) throw new Error('Knowledge graph not found');
                  const newNotes = await generateNotesWithAI(graph);
                  await updateMaterials(materialId, { notes: newNotes });
                  setMaterials((prev) => (prev ? { ...prev, notes: newNotes } : null));
                } catch (e: any) {
                  Alert.alert('Error', e?.message ?? 'Failed to generate notes.');
                } finally {
                  setNotesRegenerating(false);
                }
              }}
              disabled={notesRegenerating}
            >
              <Image source={require('../assets/icons/notesicon.png')} style={styles.editNoteIcon} />
              <Text style={styles.editNoteLabel}>{notesRegenerating ? 'Generating…' : 'Notes — Generate'}</Text>
            </Pressable>
          )}
          <View style={styles.notesStudyWrap}>
            <NotesStudy notes={notesContent} />
          </View>
          <Modal visible={editNoteModalVisible} transparent animationType="fade">
            <Pressable style={styles.modalBackdrop} onPress={() => setEditNoteModalVisible(false)}>
              <Pressable style={styles.editNoteModalCard} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.editNoteModalTitle}>What change would you like to make?</Text>
                <TextInput
                  style={styles.editNoteModalInput}
                  placeholder="e.g. make it shorter, add more on photosynthesis"
                  placeholderTextColor="#999"
                  value={editNoteInstruction}
                  onChangeText={setEditNoteInstruction}
                  multiline
                  editable={!notesRegenerating}
                />
                <View style={styles.editNoteModalActions}>
                  <Pressable style={styles.editNoteModalCancel} onPress={() => { setEditNoteModalVisible(false); setEditNoteInstruction(''); }}>
                    <Text style={styles.editNoteModalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.editNoteModalRegen, (!editNoteInstruction.trim() || notesRegenerating) && styles.editNoteModalRegenDisabled]}
                    onPress={async () => {
                      if (!materialId || !notesContent?.trim() || !editNoteInstruction.trim() || notesRegenerating) return;
                      setNotesRegenerating(true);
                      try {
                        const newNotes = await reviseNotesWithAI(notesContent, editNoteInstruction.trim());
                        await updateMaterials(materialId, { notes: newNotes });
                        setMaterials((prev) => (prev ? { ...prev, notes: newNotes } : null));
                        setEditNoteModalVisible(false);
                        setEditNoteInstruction('');
                      } catch (e: any) {
                        Alert.alert('Error', e?.message ?? 'Failed to update notes.');
                      } finally {
                        setNotesRegenerating(false);
                      }
                    }}
                    disabled={!editNoteInstruction.trim() || notesRegenerating}
                  >
                    <Text style={styles.editNoteModalRegenText}>{notesRegenerating ? 'Regenerating…' : 'Regenerate'}</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      )}
      {activeTab === 'tutor' && <TutorStudy notes={notesContent} />}
      {activeTab === 'flashcards' && <FlashcardStudy cards={flashcardCards} onProgressUpdate={handleFlashcardProgress} />}
      {activeTab === 'written' && (
        <WrittenStudy
          items={writtenItems}
          onProgressUpdate={handleWrittenProgress}
          materialId={materialId}
          savedAnswers={writtenAnswers}
          onAnswersUpdate={handleWrittenAnswersUpdate}
        />
      )}
      {activeTab === 'fill' && (
        <FillInBlankStudy
          items={fillItems}
          onProgressUpdate={handleFillProgress}
          materialId={materialId}
          savedAnswers={fillAnswers}
          onAnswersUpdate={handleFillAnswersUpdate}
        />
      )}
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
                <View style={styles.answerTextWrap}>
                  <Text style={styles.answerText}>{ans}</Text>
                </View>
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
  generatingText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: PURPLE,
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    marginRight: 20,
  },
  backBtn: { padding: 4 },
  closeBtn: { padding: 4, marginLeft: 'auto', marginRight: -25 },
  title: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
    marginLeft: 10,  
  },
  tabs: { flexGrow: 0, flexShrink: 0, marginBottom: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ccc', marginBottom: 16, marginHorizontal: -24, alignSelf: 'stretch',
  },
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
  notesTabWrap: { flex: 1 },
  editNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  generateNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  editNoteIcon: { width: 24, height: 24 },
  editNoteLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: PURPLE },
  notesStudyWrap: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  editNoteModalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  editNoteModalTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    marginBottom: 16,
  },
  editNoteModalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  editNoteModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  editNoteModalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  editNoteModalCancelText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#666' },
  editNoteModalRegen: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  editNoteModalRegenDisabled: { opacity: 0.5 },
  editNoteModalRegenText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#fff' },
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
    paddingHorizontal: 20,
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
    marginRight: 14,
  },
  answerTextWrap: {
    flex: 1,
    minWidth: 0,
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
