import { GeneratingContentScreen } from '@/components/GeneratingContentScreen';
import { FillInBlankStudy } from '@/components/FillInBlankStudy';
import { FlashcardStudy } from '@/components/FlashcardStudy';
import { NotesStudy } from '@/components/NotesStudy';
import { TutorStudy } from '@/components/TutorStudy';
import { WrittenStudy } from '@/components/WrittenStudy';
import { getMaterials, updateMaterials } from '@/lib/study-materials-storage';
import { recordMasteryAchieved } from '@/lib/streak';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callOpenAIChat, callOpenAIText, isOpenAIConfigured } from '@/lib/openai-service';

const SALMON = '#FD8A8A';
const PURPLE = '#7c3aed';

const ALL_TABS: { id: string; label: string; icon?: ReturnType<typeof require>; iconText?: string }[] = [
  { id: 'notes', label: 'Notes', icon: require('../assets/icons/notesicon.png') },
  { id: 'flashcards', label: 'Flashcard', icon: require('../assets/icons/flashcardicon.png') },
  { id: 'quiz', label: 'Quiz', icon: require('../assets/icons/quizicon.png') },
  { id: 'written', label: 'Written', icon: require('../assets/icons/pencilicon.png') },
  { id: 'fill', label: 'Fill in the blank', iconText: '_' },
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

// Randomize quiz options while updating correct answer index
const shuffleQuizOptions = (question: { question: string; options: string[]; correct_answer_index: number; id?: string }) => {
  const correctAnswer = question.options[question.correct_answer_index];
  const shuffledOptions = [...question.options];

  // Deterministic seeded shuffle based on question ID so order is stable across sessions
  const seed = question.id
    ? [...question.id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
    : 42;
  let s = seed;
  const rand = () => { s = Math.imul(s, 1664525) + 1013904223; return ((s >>> 0) / 0xffffffff); };
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }

  const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);

  return {
    ...question,
    options: shuffledOptions,
    correct_answer_index: newCorrectIndex,
  };
};

export default function GenerateQuizScreen() {
  const insets = useSafeAreaInsets();
  const { methods, materialId, wrongOnly } = useLocalSearchParams<{ methods?: string; materialId?: string; wrongOnly?: string }>();
  const isWrongOnly = wrongOnly === 'true';
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
  const [flashcardInitIdx, setFlashcardInitIdx] = useState(0);
  const [writtenInitIdx, setWrittenInitIdx] = useState(0);
  const [fillInitIdx, setFillInitIdx] = useState(0);
  const [sessionQuizCorrect, setSessionQuizCorrect] = useState(0);
  const [quizTotalFull, setQuizTotalFull] = useState(0);
  const [flashcardCorrect, setFlashcardCorrect] = useState(0);
  const [flashcardTotal, setFlashcardTotal] = useState(0);
  const [flashcardTotalFull, setFlashcardTotalFull] = useState(0);
  const [writtenCorrect, setWrittenCorrect] = useState(0);
  const [writtenTotal, setWrittenTotal] = useState(0);
  const [writtenTotalFull, setWrittenTotalFull] = useState(0);
  const [fillCorrect, setFillCorrect] = useState(0);
  const [fillTotal, setFillTotal] = useState(0);
  const [fillTotalFull, setFillTotalFull] = useState(0);
  const [flashcardDisplayMap, setFlashcardDisplayMap] = useState<Record<string, number>>({});
  const [writtenDisplayMap, setWrittenDisplayMap] = useState<Record<string, number>>({});
  const [fillDisplayMap, setFillDisplayMap] = useState<Record<string, number>>({});
  const [generatingMessage, setGeneratingMessage] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [flashcardAnswers, setFlashcardAnswers] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, { answer: string; correct: boolean; explanation?: string }>>({});
  const [fillAnswers, setFillAnswers] = useState<Record<string, { answer: string; correct: boolean; explanation?: string }>>({});
  const [editNoteModalVisible, setEditNoteModalVisible] = useState(false);
  const [editNoteInstruction, setEditNoteInstruction] = useState('');
  const [notesRegenerating, setNotesRegenerating] = useState(false);
  const [streakPopup, setStreakPopup] = useState<number | null>(null);
  const streakFiredRef = useRef(false);
  const creditedRef = useRef<Set<string>>(new Set());
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainText, setExplainText] = useState('');
  const [explainChatMessages, setExplainChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [explainChatInput, setExplainChatInput] = useState('');
  const [explainChatSending, setExplainChatSending] = useState(false);
  const explainSlideAnim = useMemo(() => new Animated.Value(0), []);
  const explainChatScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!materialId) {
      setLoading(false);
      return;
    }
    
    const applyWrongFilter = (mat: NonNullable<Awaited<ReturnType<typeof getMaterials>>>) => {
      if (!isWrongOnly) return mat;
      const qa = mat.user_answers?.quiz_questions ?? {};
      const fa = mat.user_answers?.flashcards ?? {};
      const wa = mat.user_answers?.written_questions ?? {};
      const fia = mat.user_answers?.fill_in_blank_questions ?? {};

      console.log('[WrongFilter] quiz saved answers:', JSON.stringify(qa));
      console.log('[WrongFilter] total quiz questions:', mat.quiz_questions.length);
      mat.quiz_questions.forEach((q) => {
        const saved = qa[q.id];
        const status = saved === undefined ? 'unanswered' : saved === q.correct_answer_index ? 'correct' : 'wrong';
        console.log(`[WrongFilter] Q id=${q.id} savedIdx=${saved} correctIdx=${q.correct_answer_index} → ${status}`);
      });

      const filteredQuiz = mat.quiz_questions.filter((q) => qa[q.id] === undefined || qa[q.id] !== q.correct_answer_index);
      console.log('[WrongFilter] filtered quiz count (wrong+unanswered):', filteredQuiz.length);
      const filteredFlashcards = mat.flashcards.filter((f) => fa[f.id] !== 'correct');
      const filteredWritten = mat.written_questions.filter((w) => !wa[w.id]?.correct);
      const filteredFill = mat.fill_in_blank_questions.filter((f) => !fia[f.id]?.correct);

      // Clear saved answers only for wrong/unanswered questions so they appear fresh
      const clearedQa = { ...qa };
      filteredQuiz.forEach((q) => delete clearedQa[q.id]);
      const clearedFa = { ...fa };
      filteredFlashcards.forEach((f) => delete clearedFa[f.id]);
      const clearedWa = { ...wa };
      filteredWritten.forEach((w) => delete clearedWa[w.id]);
      const clearedFia = { ...fia };
      filteredFill.forEach((f) => delete clearedFia[f.id]);

      return {
        ...mat,
        quiz_questions: filteredQuiz,
        flashcards: filteredFlashcards,
        written_questions: filteredWritten,
        fill_in_blank_questions: filteredFill,
        // Keep progress intact — original correct counts preserved
        user_answers: { quiz_questions: clearedQa, flashcards: clearedFa, written_questions: clearedWa, fill_in_blank_questions: clearedFia },
      };
    };

    const loadAndGenerate = async () => {
      const raw = await getMaterials(materialId);
      console.log('[LoadQuiz] isWrongOnly:', isWrongOnly, '| raw quiz count:', raw?.quiz_questions?.length, '| saved progress:', JSON.stringify(raw?.progress), '| saved answers keys:', Object.keys(raw?.user_answers?.quiz_questions ?? {}));
      const m = raw ? applyWrongFilter(raw) : null;
      if (!m) {
        setLoading(false);
        return;
      }

      setTitle(m.title ?? 'Title');
      // Store unfiltered totals so progress bar and counters always reference the real full set
      setQuizTotalFull(raw?.quiz_questions?.length ?? 0);
      setFlashcardTotalFull(raw?.flashcards?.length ?? 0);
      setWrittenTotalFull(raw?.written_questions?.length ?? 0);
      setFillTotalFull(raw?.fill_in_blank_questions?.length ?? 0);
      // Display index maps: map each item id → its 1-based position in the full original set
      setFlashcardDisplayMap(Object.fromEntries((raw?.flashcards ?? []).map((f, i) => [f.id, i + 1])));
      setWrittenDisplayMap(Object.fromEntries((raw?.written_questions ?? []).map((w, i) => [w.id, i + 1])));
      setFillDisplayMap(Object.fromEntries((raw?.fill_in_blank_questions ?? []).map((f, i) => [f.id, i + 1])));

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
            const updatedRaw = await getMaterials(materialId);
            const updated = updatedRaw ? applyWrongFilter(updatedRaw) : null;
            if (updated) {
              setMaterials({
                flashcards: updated.flashcards.map((f) => ({ id: f.id, front: f.front, back: f.back })),
                quiz_questions: updated.quiz_questions.map((q) => shuffleQuizOptions({
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
              setSessionQuizCorrect(updated.progress?.multipleChoice ?? 0);
              const firstQuiz = qq.findIndex((q) => qa[q.id] === undefined);
              setQuestionIndex(firstQuiz === -1 ? 0 : firstQuiz);
              const fa2 = updated.user_answers?.flashcards ?? {};
              const firstFlash = (updated.flashcards ?? []).findIndex((f) => !fa2[f.id]);
              setFlashcardInitIdx(firstFlash === -1 ? 0 : firstFlash);
              const wa2 = updated.user_answers?.written_questions ?? {};
              const firstWritten = (updated.written_questions ?? []).findIndex((w) => !wa2[w.id]);
              setWrittenInitIdx(firstWritten === -1 ? 0 : firstWritten);
              const fia2 = updated.user_answers?.fill_in_blank_questions ?? {};
              const firstFill = (updated.fill_in_blank_questions ?? []).findIndex((f) => !fia2[f.id]);
              setFillInitIdx(firstFill === -1 ? 0 : firstFill);
            }
          }
        } catch (error) {
          console.error('Failed to generate missing content:', error);
        }
      } else {
        // No generation needed, just load existing content
        setMaterials({
          flashcards: m.flashcards.map((f) => ({ id: f.id, front: f.front, back: f.back })),
          quiz_questions: m.quiz_questions.map((q) => shuffleQuizOptions({
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
        // In practice mode, seed from existing correct count so saving never reduces mastery
        setSessionQuizCorrect(m.progress?.multipleChoice ?? 0);
        const firstQuiz = qq.findIndex((q) => qa[q.id] === undefined);
        setQuestionIndex(firstQuiz === -1 ? 0 : firstQuiz);
        const fa = m.user_answers?.flashcards ?? {};
        const firstFlash = (m.flashcards ?? []).findIndex((f) => !fa[f.id]);
        setFlashcardInitIdx(firstFlash === -1 ? 0 : firstFlash);
        const wa = m.user_answers?.written_questions ?? {};
        const firstWritten = (m.written_questions ?? []).findIndex((w) => !wa[w.id]);
        setWrittenInitIdx(firstWritten === -1 ? 0 : firstWritten);
        const fia = m.user_answers?.fill_in_blank_questions ?? {};
        const firstFill = (m.fill_in_blank_questions ?? []).findIndex((f) => !fia[f.id]);
        setFillInitIdx(firstFill === -1 ? 0 : firstFill);
      }

      setLoading(false);
    };

    loadAndGenerate();
  }, [materialId, methodsStr, isWrongOnly]);

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

  const explainPanelHeight = Dimensions.get('window').height * 0.5;
  useEffect(() => {
    Animated.timing(explainSlideAnim, {
      toValue: explainOpen ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [explainOpen, explainSlideAnim]);

  const quizQuestions = useMemo(() => {
    const qs = materials?.quiz_questions ?? [];
    const base = isWrongOnly || qs.length >= 10
      ? qs
      : [...qs, ...SCAFFOLD_QUIZ.map((q, i) => ({ id: `scaffold_${i}`, ...q }))].slice(0, 10);
    return base.map(shuffleQuizOptions);
  }, [materials?.quiz_questions, isWrongOnly]);

  // Compute overall mastery across ALL methods (not just selected) so bar matches home/report
  const overallMastery = useMemo(() => {
    const pairs: [number, number][] = [];
    const qTotal = quizTotalFull > 0 ? quizTotalFull : quizQuestions.length;
    if (qTotal > 0) pairs.push([sessionQuizCorrect, qTotal]);
    if (flashcardTotal > 0) pairs.push([flashcardCorrect, flashcardTotal]);
    if (writtenTotal > 0) pairs.push([writtenCorrect, writtenTotal]);
    if (fillTotal > 0) pairs.push([fillCorrect, fillTotal]);
    const totalCorrect = pairs.reduce((s, [c]) => s + c, 0);
    const totalQs = pairs.reduce((s, [, t]) => s + t, 0);
    return totalQs > 0 ? Math.min(100, Math.round((totalCorrect / totalQs) * 100)) : 0;
  }, [sessionQuizCorrect, quizTotalFull, flashcardCorrect, flashcardTotal, writtenCorrect, writtenTotal, fillCorrect, fillTotal, selectedIds, quizQuestions.length]);

  useEffect(() => {
    if (overallMastery >= 75 && !streakFiredRef.current && !loading) {
      streakFiredRef.current = true;
      recordMasteryAchieved().then((newStreak) => {
        if (newStreak !== null) setStreakPopup(newStreak);
      });
    }
  }, [overallMastery, loading]);

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
  };

  const handleFlashcardAnswersUpdate = (answers: Record<string, 'correct' | 'incorrect'>) => {
    setFlashcardAnswers(answers);
    const correct = Object.values(answers).filter((a) => a === 'correct').length;
    setFlashcardCorrect(correct);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          const cappedCorrect = Math.min(correct, flashcardTotalFull || (m.flashcards?.length ?? 0));
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, flashcards: { ...m.user_answers?.flashcards, ...answers } },
            progress: { ...m.progress, flashcards: cappedCorrect },
          });
        }
      });
    }
  };

  const handleWrittenProgress = (correct: number, total: number) => {
    setWrittenCorrect(correct);
    setWrittenTotal(total);
  };

  const handleWrittenAnswersUpdate = (answers: Record<string, { answer: string; correct: boolean; explanation?: string }>) => {
    setWrittenAnswers(answers);
    const correct = Object.values(answers).filter((r) => r.correct).length;
    setWrittenCorrect(correct);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          const cappedCorrect = Math.min(correct, writtenTotalFull || (m.written_questions?.length ?? 0));
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, written_questions: { ...m.user_answers?.written_questions, ...answers } },
            progress: { ...m.progress, written: cappedCorrect },
          });
        }
      });
    }
  };

  const handleFillProgress = (correct: number, total: number) => {
    setFillCorrect(correct);
    setFillTotal(total);
  };

  const handleFillAnswersUpdate = (answers: Record<string, { answer: string; correct: boolean; explanation?: string }>) => {
    setFillAnswers(answers);
    const correct = Object.values(answers).filter((r) => r.correct).length;
    setFillCorrect(correct);
    if (materialId) {
      getMaterials(materialId).then((m) => {
        if (m) {
          const cappedCorrect = Math.min(correct, fillTotalFull || (m.fill_in_blank_questions?.length ?? 0));
          updateMaterials(materialId, {
            user_answers: { ...m.user_answers, fill_in_blank_questions: { ...m.user_answers?.fill_in_blank_questions, ...answers } },
            progress: { ...m.progress, fillInBlanks: cappedCorrect },
          });
        }
      });
    }
  };

  const writtenItems = materials?.written_questions?.map((w) => ({ id: w.id, question: w.question })) ?? undefined;
  const fillItems = materials?.fill_in_blank_questions?.map((f) => ({ id: f.id, text: f.text, answer: f.answer })) ?? undefined;
  const notesContent = materials?.notes ?? undefined;
  const quizData = quizQuestions[questionIndex] ?? { id: 'scaffold_0', ...SCAFFOLD_QUIZ[0] };
  const correctIndex = quizData.correct_answer_index;
  const answered = selectedAnswer !== null;
  const totalQuestions = quizQuestions.length;
  const displayTotal = quizTotalFull > 0 ? Math.max(quizTotalFull, 10) : totalQuestions;
  const displayIndex = isWrongOnly
    ? (materials?.quiz_questions?.findIndex((q) => q.id === quizData.id) ?? -1) + 1 || questionIndex + 1
    : questionIndex + 1;

  const handleSelectAnswer = (i: number) => {
    if (answered) return;
    setSelectedAnswer(i);
    const isCorrect = i === correctIndex;
    const newCorrect = isCorrect && !creditedRef.current.has(quizData.id) && !quizData.id.startsWith('scaffold_');
    if (newCorrect) {
      creditedRef.current.add(quizData.id);
      setSessionQuizCorrect((prev) => prev + 1);
    }
    if (materialId && !quizData.id.startsWith('scaffold_')) {
      const updatedAnswers = { ...quizAnswers, [quizData.id]: i };
      setQuizAnswers(updatedAnswers);
      getMaterials(materialId).then((m) => {
        if (!m) return;
        const realAnswers = Object.fromEntries(
          Object.entries(updatedAnswers).filter(([id]) => !id.startsWith('scaffold_'))
        );
        const currentCorrect = newCorrect ? sessionQuizCorrect + 1 : sessionQuizCorrect;
        const realCorrect = Math.min(currentCorrect, quizTotalFull || (m.quiz_questions?.length ?? 0));
        console.log(`[SaveAnswer] Q id=${quizData.id} selectedIdx=${i} correctIdx=${correctIndex} isCorrect=${isCorrect} newCorrect=${newCorrect} realCorrect=${realCorrect}/${quizTotalFull}`);
        console.log('[SaveAnswer] merging answers:', JSON.stringify(realAnswers));
        updateMaterials(materialId, {
          user_answers: { ...m.user_answers, quiz_questions: { ...m.user_answers?.quiz_questions, ...realAnswers } },
          progress: { ...m.progress, multipleChoice: realCorrect },
        });
      });
    }
  };

  const openExplain = () => {
    setExplainOpen(true);
    setExplainChatMessages([]);
    setExplainText('');
    setExplainLoading(true);
    const q = quizData.question;
    const opts = quizData.options ?? [];
    const correctIdx = quizData.correct_answer_index ?? 0;
    const correct = opts[correctIdx] ?? '';
    const chosen = selectedAnswer !== null ? (opts[selectedAnswer] ?? '') : '';
    const wrong = selectedAnswer !== null && selectedAnswer !== correctIdx;
    const systemPrompt = 'You are a study tutor. In 2-4 sentences explain why the user\'s answer was wrong and why the correct answer is right. Be clear and encouraging.';
    const userPrompt = `Question: ${q}\nOptions: ${opts.map((o, i) => `${i + 1}. ${o}`).join('\n')}\nCorrect answer: ${correct}\nUser chose: ${chosen}\nUser was ${wrong ? 'wrong' : 'correct'}.`;
    if (!isOpenAIConfigured()) {
      setExplainText('OpenAI is not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to .env to get AI explanations.');
      setExplainChatMessages([{ role: 'assistant', content: 'OpenAI is not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to .env to get AI explanations.' }]);
      setExplainLoading(false);
      return;
    }
    callOpenAIText(systemPrompt, userPrompt, { maxTokens: 256 })
      .then((text) => {
        setExplainText(text);
        setExplainChatMessages([{ role: 'assistant', content: text }]);
      })
      .catch(() => {
        setExplainText('Could not load explanation. Please try again.');
        setExplainChatMessages([{ role: 'assistant', content: 'Could not load explanation. Please try again.' }]);
      })
      .finally(() => setExplainLoading(false));
  };

  const sendExplainChat = (suggestion?: string) => {
    const msg = (suggestion ?? explainChatInput.trim()).trim();
    if (!msg || explainChatSending) return;
    const userMsg = { role: 'user' as const, content: msg };
    setExplainChatMessages((prev) => [...prev, userMsg]);
    if (!suggestion) setExplainChatInput('');
    setExplainChatSending(true);
    const systemMsg = { role: 'system' as const, content: `You are a study tutor. Context: Quiz question: "${quizData.question}". Correct answer: "${(quizData.options ?? [])[quizData.correct_answer_index ?? 0] ?? ''}". User's answer: "${selectedAnswer !== null ? (quizData.options ?? [])[selectedAnswer] ?? '' : ''}". Keep responses clear and concise.` };
    callOpenAIChat([systemMsg, ...explainChatMessages, userMsg], { maxTokens: 256 })
      .then((reply) => {
        setExplainChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      })
      .catch(() => {
        setExplainChatMessages((prev) => [...prev, { role: 'assistant', content: 'Could not get response. Try again.' }]);
      })
      .finally(() => setExplainChatSending(false));
  };

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
    if (answered && materialId && quizData.id && !quizData.id.startsWith('scaffold_')) {
      getMaterials(materialId).then((m) => {
        if (m) {
          const realCorrect = Math.min(sessionQuizCorrect, quizTotalFull || (m.quiz_questions?.length ?? 0));
          updateMaterials(materialId, {
            progress: { ...m.progress, multipleChoice: realCorrect },
          });
        }
      });
    }

    if (questionIndex >= totalQuestions - 1) return;
    setSelectedAnswer(null);
    setQuestionIndex((i) => i + 1);
    setExplainOpen(false);
    setExplainChatMessages([]);
    setExplainText('');
  };

  const tryAgain = () => {
    setSelectedAnswer(null);
    setQuizAnswers((prev) => {
      const next = { ...prev };
      delete next[quizData.id];
      return next;
    });
  };

  const goPrev = () => {
    if (questionIndex <= 0) return;
    setQuestionIndex((i) => i - 1);
    setExplainOpen(false);
    setExplainChatMessages([]);
    setExplainText('');
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
      {/* Mastery progress bar */}
      <View style={styles.masteryBarBg}>
        <View style={[styles.masteryBarFill, { width: `${overallMastery}%` }]} />
      </View>
      <ScrollView
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tabs} 
        contentContainerStyle={styles.tabsContent}
        bounces={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {tabs.map((t) => (
          <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={[styles.tab, activeTab === t.id && styles.tabActive]}>
            {t.iconText ? (
              <Text style={styles.tabIconText}>{t.iconText}</Text>
            ) : (
              <Image source={t.icon} style={styles.tabIcon} />
            )}
            <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.divider} />

      {activeTab === 'notes' && (
        <View style={styles.notesTabWrap}>
          {!notesContent?.trim() && (
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
            <NotesStudy
              notes={notesContent}
              footer={notesContent?.trim() ? (
                <Pressable
                  style={styles.editNoteBtn}
                  onPress={() => setEditNoteModalVisible(true)}
                  disabled={notesRegenerating}
                >
                  <Image source={require('../assets/icons/notesicon.png')} style={styles.editNoteIcon} />
                  <Text style={styles.editNoteLabel}>Edit note</Text>
                </Pressable>
              ) : undefined}
            />
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
      {activeTab === 'flashcards' && <FlashcardStudy cards={flashcardCards} onProgressUpdate={handleFlashcardProgress} materialId={materialId} savedAnswers={flashcardAnswers} onAnswersUpdate={handleFlashcardAnswersUpdate} initialIndex={flashcardInitIdx} displayTotal={flashcardTotalFull || undefined} displayIndexMap={flashcardDisplayMap} />}
      {activeTab === 'written' && (
        <WrittenStudy
          items={writtenItems}
          onProgressUpdate={handleWrittenProgress}
          materialId={materialId}
          savedAnswers={writtenAnswers}
          onAnswersUpdate={handleWrittenAnswersUpdate}
          initialIndex={writtenInitIdx}
          displayTotal={writtenTotalFull || undefined}
          displayIndexMap={writtenDisplayMap}
        />
      )}
      {activeTab === 'fill' && (
        <FillInBlankStudy
          items={fillItems}
          onProgressUpdate={handleFillProgress}
          materialId={materialId}
          savedAnswers={fillAnswers}
          onAnswersUpdate={handleFillAnswersUpdate}
          initialIndex={fillInitIdx}
          displayTotal={fillTotalFull || undefined}
          displayIndexMap={fillDisplayMap}
        />
      )}
      {activeTab === 'quiz' && (
        <>
          <ScrollView 
            style={styles.body} 
            contentContainerStyle={styles.bodyContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            alwaysBounceVertical={false}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            alwaysBounceVertical={false}
            removeClippedSubviews={false}
            scrollEventThrottle={16}
          >
            <Text style={styles.question}>{quizData.question}</Text>
            {quizData.options.map((ans, i) => (
              <Pressable
                key={i}
                style={getAnswerCardStyle(i)}
                onPress={() => handleSelectAnswer(i)}
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
          {answered && (
            <View style={selectedAnswer !== correctIndex ? styles.buttonRow : styles.buttonRowCenter}>
              <Pressable style={[styles.explainBtnRow, selectedAnswer === correctIndex && styles.explainBtnSolo]} onPress={openExplain}>
                <Ionicons name="star" size={20} color="#fff" />
                <Text style={styles.explainBtnTextRow}>Explain</Text>
              </Pressable>
              {selectedAnswer !== correctIndex && (
                <Pressable style={styles.tryAgainBtnRow} onPress={tryAgain}>
                  <Text style={styles.tryAgainTextRow}>Try Again</Text>
                </Pressable>
              )}
            </View>
          )}
          <View style={styles.quizDivider} />
          <View style={styles.quizNav}>
            <Pressable onPress={goPrev} style={styles.quizNavBtn} disabled={questionIndex === 0}>
              <Ionicons name="chevron-back" size={24} color={questionIndex === 0 ? '#999' : '#fff'} />
            </Pressable>
            <Text style={styles.quizNavCounter}>{displayIndex}/{displayTotal}</Text>
            <Pressable onPress={goNext} style={styles.quizNavBtn} disabled={questionIndex === totalQuestions - 1}>
              <Ionicons name="chevron-forward" size={24} color={questionIndex === totalQuestions - 1 ? '#999' : '#fff'} />
            </Pressable>
          </View>
        </>
      )}
      {!['notes', 'tutor', 'flashcards', 'written', 'fill', 'quiz'].includes(activeTab) && (
        <View style={styles.body}><Text style={styles.question}>Coming soon</Text></View>
      )}
      {explainOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExplainOpen(false)} />
          <Animated.View
            style={[
              styles.explainPanel,
              { height: explainPanelHeight, transform: [{ translateY: explainSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [explainPanelHeight, 0] }) }] },
            ]}
          >
            <View style={styles.explainHeader}>
              <Text style={styles.explainTitle}>AI Tutor</Text>
              <Pressable onPress={() => setExplainOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#333" />
              </Pressable>
            </View>
            {explainLoading ? (
              <View style={styles.explainLoadingWrap}>
                <ActivityIndicator size="large" color={PURPLE} />
                <Text style={styles.explainLoadingText}>Getting explanation…</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  ref={explainChatScrollRef}
                  style={styles.explainChat}
                  contentContainerStyle={styles.explainChatContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={true}
                  alwaysBounceVertical={false}
                  removeClippedSubviews={false}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => explainChatScrollRef.current?.scrollToEnd({ animated: true })}
                  bounces={true}
                  alwaysBounceVertical={false}
                  removeClippedSubviews={false}
                  scrollEventThrottle={16}
                  nestedScrollEnabled={true}
                >
                  {explainChatMessages.map((msg, i) => (
                    <View key={i} style={[styles.explainBubble, msg.role === 'user' && styles.explainBubbleUser]}>
                      <Text style={[styles.explainBubbleText, msg.role === 'user' && styles.explainBubbleTextUser]}>{msg.content}</Text>
                    </View>
                  ))}
                  {explainChatSending && (
                    <View style={[styles.explainBubble, styles.explainBubbleUser]}>
                      <ActivityIndicator size="small" color={PURPLE} />
                    </View>
                  )}
                </ScrollView>
                <Pressable
                  style={styles.explainSuggestionBtn}
                  onPress={() => sendExplainChat("Explain this to me like I'm 10")}
                  disabled={explainChatSending}
                >
                  <Text style={styles.explainSuggestionText}>explain this to me like I'm 10</Text>
                </Pressable>
                <View style={styles.explainInputRow}>
                  <TextInput
                    style={styles.explainInput}
                    placeholder="Ask a follow-up…"
                    placeholderTextColor="#999"
                    value={explainChatInput}
                    onChangeText={setExplainChatInput}
                    editable={!explainChatSending}
                    multiline
                    maxLength={500}
                  />
                  <Pressable
                    style={[styles.explainSendBtn, (!explainChatInput.trim() || explainChatSending) && styles.explainSendBtnDisabled]}
                  onPress={() => sendExplainChat()}
                  disabled={!explainChatInput.trim() || explainChatSending}
                  >
                    <Ionicons name="send" size={20} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </>
      )}

      {/* Streak popup */}
      <Modal visible={streakPopup !== null} transparent animationType="fade" onRequestClose={() => setStreakPopup(null)}>
        <Pressable style={styles.streakOverlay} onPress={() => setStreakPopup(null)}>
          <View style={styles.streakCard}>
            <Text style={styles.streakPopupNum}>{streakPopup}</Text>
            <Text style={styles.streakPopupLabel}>days streak 🔥</Text>
            <Text style={styles.streakPopupMsg}>you're on fire! Keep studying and you're gonna crush it 💪</Text>
            <Pressable style={styles.streakPopupBtn} onPress={() => setStreakPopup(null)}>
              <Text style={styles.streakPopupBtnText}>Keep Going</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  progressBarWrap: { marginBottom: 12 },
  progressBarBg: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  streakOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  streakCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '85%',
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  streakPopupNum: { fontFamily: 'FredokaOne_400Regular', fontSize: 64, color: '#FD8A8A' },
  streakPopupLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 22, color: '#FD8A8A', marginBottom: 20 },
  streakPopupMsg: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#ccc', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  streakPopupBtn: { backgroundColor: '#FD8A8A', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 40 },
  streakPopupBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
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
  tabIconText: { fontSize: 14, fontFamily: 'Fredoka_400Regular', color: '#333', textDecorationLine: 'underline', width: 20, textAlign: 'center' },
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
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
    marginBottom: 20,
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
  masteryBarBg: {
    height: 6,
    backgroundColor: '#E8D8D8',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  masteryBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SALMON,
  },
  quizDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: -24,
    marginTop: 16,
    marginBottom: 0,
  },
  quizNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  quizNavBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SALMON,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizNavCounter: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
  },
  explainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
    alignSelf: 'flex-start',
  },
  explainBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#fff',
  },
  explainPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  explainTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 20,
    color: '#333',
  },
  explainLoadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  explainLoadingText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: PURPLE,
  },
  explainChat: {
    flex: 1,
  },
  explainChatContent: {
    paddingBottom: 16,
    gap: 12,
  },
  explainBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 12,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  explainBubbleUser: {
    backgroundColor: PURPLE,
    alignSelf: 'flex-end',
  },
  explainBubbleText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
  },
  explainBubbleTextUser: {
    color: '#fff',
  },
  explainSuggestionBtn: {
    alignSelf: 'center',
    backgroundColor: '#F2E4E4',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
    shadowColor: '#999',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  explainSuggestionText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#444',
  },
  explainInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  explainInput: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  explainSendBtn: {
    backgroundColor: PURPLE,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  explainSendBtnDisabled: {
    opacity: 0.5,
  },
  tryAgainBtn: {
    alignSelf: 'center',
    marginHorizontal: 32,
    width: '70%',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tryAgainText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  buttonRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  explainBtnSolo: {
    flex: 0,
  },
  tryAgainBtnRow: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tryAgainTextRow: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
  },
  explainBtnRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  explainBtnTextRow: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#fff',
  },
});
