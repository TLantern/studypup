import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { callOpenAI, callOpenAIText } from '@/lib/openai-service';
import { SF_PRO } from '@/lib/onboarding-theme';

const SALMON = '#7FA8FF';
const GREEN = '#BCFFC0';
const RED = '#EA898B';

type Item = { id: string; text: string; answer: string };

type Props = {
  items?: Item[];
  onProgressUpdate?: (correct: number, total: number) => void;
  materialId?: string;
  savedAnswers?: Record<string, { answer: string; correct: boolean; explanation?: string }>;
  onAnswersUpdate?: (answers: Record<string, { answer: string; correct: boolean; explanation?: string }>) => void;
  initialIndex?: number;
  displayTotal?: number;
  displayIndexMap?: Record<string, number>;
};

type GradeResult = {
  correct: boolean;
  explanation?: string;
};

const SCAFFOLD_ITEMS: Item[] = [
  {
    id: 'scaffold_0',
    text: 'The human immune system protects the body from harmful pathogens and foreign substances. It relies on a complex network of cells, tissues, and organs to defend against threats. One of the most important types of cells in this system is the ___, which can recognize and destroy infected or cancerous cells.',
    answer: 'T cell',
  },
  ...Array(9).fill(null).map((_, i) => ({ id: `scaffold_${i + 1}`, text: `Fill in the blank question ${i + 2}: The answer is ___.`, answer: `Answer ${i + 2}` })),
];

export function FillInBlankStudy({ items = SCAFFOLD_ITEMS, onProgressUpdate, materialId, savedAnswers = {}, onAnswersUpdate, initialIndex = 0, displayTotal, displayIndexMap }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<Record<string, { answer: string; correct: boolean; explanation?: string }>>(savedAnswers);
  const [checking, setChecking] = useState(false);
  const [inlineExplain, setInlineExplain] = useState('');
  const hydratedRef = useRef(false);
  const explanationsRef = useRef<Record<string, string>>({});
  const explainOpacity = useRef(new Animated.Value(0)).current;
  const explainY = useRef(new Animated.Value(16)).current;
  const [streak, setStreak] = useState(0);
  const lottieRef = useRef<LottieView>(null);
  const fireOpacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0.6)).current;
  const numScale = useRef(new Animated.Value(1)).current;
  const [flashVisible, setFlashVisible] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState('#4ade80');
  const { width, height: winHeight } = Dimensions.get('window');
  const borderW = Math.round(Math.min(width, winHeight) * 0.018);

  const triggerFlash = (color: string) => {
    setFlashColor(color); setFlashVisible(true); flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: 900, useNativeDriver: true }).start(() => setFlashVisible(false));
  };
  const popNumber = () => {
    numScale.setValue(1.4);
    Animated.timing(numScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };
  const triggerStreak = (correct: boolean) => {
    if (correct) {
      triggerFlash('#4ade80');
      setStreak((s) => {
        const next = s + 1;
        if (next >= 2) {
          if (next === 2) { fireOpacity.setValue(1); fireScale.setValue(0.85); lottieRef.current?.play(); }
          else { fireScale.setValue(0.85); }
          Animated.spring(fireScale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
          popNumber();
          Haptics.impactAsync(next >= 5 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
        }
        return next;
      });
    } else {
      triggerFlash('#ef4444');
      setStreak(0);
      Animated.timing(fireOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => { fireScale.setValue(0.6); numScale.setValue(1); });
    }
  };

  const list = items.length ? items : SCAFFOLD_ITEMS;
  const item = list[index];
  const total = list.length;
  const currentResult = results[item.id];

  useEffect(() => {
    if (!hydratedRef.current && Object.keys(savedAnswers).length > 0) {
      hydratedRef.current = true;
      setResults(savedAnswers);
    }
  }, [savedAnswers]);

  useEffect(() => {
    setInlineExplain('');
    explainOpacity.setValue(0);
    explainY.setValue(16);
    if (item.id && results[item.id]) {
      setAnswer(results[item.id].answer);
      if (!results[item.id].correct && explanationsRef.current[item.id]) {
        setInlineExplain(explanationsRef.current[item.id]);
        explainOpacity.setValue(1);
        explainY.setValue(0);
      }
    } else {
      setAnswer('');
    }
  }, [item.id]);

  useEffect(() => {
    const correct = Object.values(results).filter((r) => r.correct).length;
    onProgressUpdate?.(correct, total);
    onAnswersUpdate?.(results);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, total]);

  const submit = async () => {
    if (!answer.trim() || checking || currentResult) return;
    
    setChecking(true);
    try {
      const result = await gradeAnswer(item.text, answer, item.answer);
      setResults((prev) => ({ ...prev, [item.id]: { answer, ...result } }));
      triggerStreak(result.correct);
      if (!result.correct) {
        fetchAndShowExplanation(item.id, item.text, item.answer);
      }
    } catch (error) {
      console.error('Failed to grade answer:', error);
    } finally {
      setChecking(false);
    }
  };

  const prev = () => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  };
  const next = () => {
    setIndex((i) => (i < total - 1 ? i + 1 : i));
  };

  const fetchAndShowExplanation = (itemId: string, question: string, correctAnswer: string) => {
    const show = (text: string) => {
      setInlineExplain(text);
      explainOpacity.setValue(0);
      explainY.setValue(16);
      Animated.parallel([
        Animated.timing(explainOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(explainY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    };
    if (explanationsRef.current[itemId]) { show(explanationsRef.current[itemId]); return; }
    callOpenAIText(
      'You are a study tutor. In 1 concise sentence, explain why the correct answer is right.',
      `Fill-in-the-blank: ${question}\nCorrect answer: ${correctAnswer}`,
      { maxTokens: 80 }
    ).then((text) => { explanationsRef.current[itemId] = text; show(text); }).catch(() => {});
  };

  const tryAgain = () => {
    setInlineExplain('');
    explainOpacity.setValue(0);
    explainY.setValue(16);
    setResults((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setAnswer('');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.wrap}>
        <Modal visible={flashVisible} transparent animationType="none" statusBarTranslucent>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: borderW, borderColor: flashColor, opacity: flashOpacity }]} />
        </Modal>
        <Animated.View pointerEvents="none" style={[styles.streakWrap, { opacity: fireOpacity, transform: [{ scale: fireScale }] }]}>
          <Animated.Text style={[styles.streakCount, { transform: [{ scale: numScale }] }]}>{streak}</Animated.Text>
          <LottieView ref={lottieRef} source={require('../assets/Flame animation.json')} style={styles.fireLottie} loop autoPlay={false} />
        </Animated.View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.wrapContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.question}>{item.text}</Text>
      <TextInput
        style={styles.input}
        placeholder="Type your answer here"
        placeholderTextColor="#999"
        value={answer}
        onChangeText={setAnswer}
        editable={!currentResult}
      />
      {!currentResult && (
        <Pressable
          style={[styles.submitBtn, (!answer.trim() || checking) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!answer.trim() || checking}
        >
          {checking ? (
            <Ionicons name="hourglass-outline" size={20} color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </Pressable>
      )}
      {currentResult?.correct && (
        <View style={styles.resultCorrect}>
          <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
          <Text style={styles.resultCorrectText}>Correct</Text>
        </View>
      )}
      {currentResult && !currentResult.correct && (
        <>
          <View style={styles.resultWrong}>
            <Ionicons name="close-circle" size={32} color="#dc2626" />
            <Text style={styles.resultWrongText}>Incorrect</Text>
          </View>
          {inlineExplain ? (
            <Animated.View style={[styles.inlineExplainWrap, { opacity: explainOpacity, transform: [{ translateY: explainY }] }]}>
              <Ionicons name="bulb-outline" size={16} color="#E06C78" style={{ marginRight: 6 }} />
              <Text style={styles.inlineExplainText}>{inlineExplain}</Text>
            </Animated.View>
          ) : null}
          <Pressable style={styles.tryAgainBtn} onPress={tryAgain}>
            <Text style={styles.tryAgainText}>Try again</Text>
          </Pressable>
        </>
      )}
      
    </ScrollView>
    <View style={styles.divider} />
    <View style={styles.nav}>
      <Pressable onPress={prev} style={styles.navBtn} disabled={index === 0}>
        <Ionicons name="chevron-back" size={24} color={index === 0 ? '#999' : '#fff'} />
      </Pressable>
      <Text style={styles.counter}>{displayIndexMap?.[item.id] ?? (index + 1)}/{displayTotal ?? total}</Text>
      <Pressable onPress={next} style={styles.navBtn} disabled={index === total - 1}>
        <Ionicons name="chevron-forward" size={24} color={index === total - 1 ? '#999' : '#fff'} />
      </Pressable>
    </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

async function gradeAnswer(
  question: string,
  userAnswer: string,
  expectedAnswer: string
): Promise<GradeResult> {
  const systemPrompt = `You are an expert educator grading fill-in-the-blank questions.
These questions expect brief, focused answers filling in missing information.

Grading criteria:
- Be lenient with minor spelling/grammar issues
- Accept answers that capture the core concept, even if worded differently
- Don't require exact phrasing - focus on accuracy of the concept
- Consider synonyms and alternative phrasings that mean the same thing

Return JSON in this format:
{
  "correct": true/false,
  "explanation": "Brief explanation if incorrect (1 sentence)"
}`;

  const userPrompt = `Fill-in-the-blank: ${question}
Expected answer: ${expectedAnswer}
Student answer: ${userAnswer}

Is this answer correct or close enough?`;

  try {
    const parsed = await callOpenAI<{ correct: boolean; explanation?: string }>(systemPrompt, userPrompt);
    return {
      correct: parsed.correct === true,
      explanation: parsed.correct ? undefined : parsed.explanation,
    };
  } catch (error) {
    console.error('Failed to grade answer:', error);
    return { correct: false, explanation: 'Unable to grade answer. Please try again.' };
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  streakWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, gap: 0 },
  streakCount: { fontFamily: SF_PRO, fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: -8, marginRight: -14 },
  fireLottie: { width: 68, height: 68 },
  scroll: { flex: 1 },
  wrapContent: { paddingVertical: 24, paddingBottom: 48 },
  question: {
    fontFamily: SF_PRO,
    fontSize: 18,
    color: '#333',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontFamily: SF_PRO,
    fontSize: 16,
    color: '#333',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 24,
  },
  submitBtn: {
    backgroundColor: SALMON,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitText: { fontFamily: SF_PRO, fontSize: 18, color: '#fff' },
  resultCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: GREEN,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#81FF88',
  },
  resultCorrectText: { fontFamily: SF_PRO, fontSize: 18, color: '#fff' },
  resultWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: RED,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 4,
    borderColor: '#F5686A',
  },
  resultWrongText: { fontFamily: SF_PRO, fontSize: 18, color: '#fff' },
  submitBtnDisabled: { opacity: 0.5 },
  inlineExplainWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff0f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fdd',
  },
  inlineExplainText: {
    flex: 1,
    fontFamily: SF_PRO,
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tryAgainText: { fontFamily: SF_PRO, fontSize: 16, color: '#333' },
  divider: { height: 1, backgroundColor: '#ddd', marginHorizontal: -24, marginTop: 16, marginBottom: 0 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SALMON,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: { fontFamily: SF_PRO, fontSize: 18, color: '#333' },
});
