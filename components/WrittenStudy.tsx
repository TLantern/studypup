import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { callOpenAI, callOpenAIChat, callOpenAIText, isOpenAIConfigured } from '@/lib/openai-service';

const SALMON = '#7FA8FF';
const GREEN = '#BCFFC0';
const RED = '#EA898B';
const PURPLE = '#7FA8FF';

type Item = { id: string; question: string; expectedAnswer?: string };

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
  answer: string;
  correct: boolean;
  explanation?: string;
};

const SCAFFOLD_ITEMS: Item[] = [
  { id: 'scaffold_0', question: 'What part of the cell is responsible for producing energy?', expectedAnswer: 'Mitochondria' },
  ...Array(9).fill(null).map((_, i) => ({ id: `scaffold_${i + 1}`, question: `Question ${i + 2}`, expectedAnswer: `Answer ${i + 2}` })),
];

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function WrittenStudy({ items = SCAFFOLD_ITEMS, onProgressUpdate, materialId, savedAnswers = {}, onAnswersUpdate, initialIndex = 0, displayTotal, displayIndexMap }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<Record<string, GradeResult>>(savedAnswers);
  const [checking, setChecking] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const chatScrollRef = useRef<ScrollView>(null);
  const explainPanelHeight = Dimensions.get('window').height * 0.5;
  const hydratedRef = useRef(false);
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
          const targetScale = Math.min(1 + (next - 2) * 0.08, 1.6);
          if (next === 2) { fireOpacity.setValue(1); fireScale.setValue(0.6); lottieRef.current?.play(); }
          Animated.spring(fireScale, { toValue: targetScale, friction: 5, tension: 200, useNativeDriver: true }).start();
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
    if (item.id && results[item.id]) {
      setAnswer(results[item.id].answer);
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
      const result = await gradeAnswer(item.question, answer, item.expectedAnswer);
      setResults((prev) => ({ ...prev, [item.id]: { ...result, answer } }));
      triggerStreak(result.correct);
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

  const tryAgain = () => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setAnswer('');
  };

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showExplain ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [showExplain, slideAnim]);

  const openExplain = async () => {
    slideAnim.setValue(0);
    setShowExplain(true);
    setChatMessages([]);
    setChatLoading(true);
    if (!isOpenAIConfigured()) {
      setChatMessages([{ role: 'assistant', content: 'OpenAI is not configured. Add EXPO_PUBLIC_OPENAI_API_KEY to .env to get AI explanations.' }]);
      setChatLoading(false);
      return;
    }
    try {
      const systemPrompt = "You are a study tutor. In 2-4 sentences explain why the user's answer was wrong or right and clarify the concept. Be clear and encouraging.";
      const userPrompt = `Question: ${item.question}\nStudent's answer: ${answer}\n${currentResult?.explanation ? `Why it was incorrect: ${currentResult.explanation}\n` : ''}Student was ${currentResult?.correct ? 'correct' : 'incorrect'}.`;
      const text = await callOpenAIText(systemPrompt, userPrompt, { maxTokens: 256 });
      setChatMessages([{ role: 'assistant', content: text }]);
    } catch (error) {
      console.error('Failed to get explanation:', error);
      setChatMessages([{ role: 'assistant', content: 'Could not load explanation. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendChat = async (suggestion?: string) => {
    const msg = (suggestion ?? chatInput.trim()).trim();
    if (!msg || chatSending) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    if (!suggestion) setChatInput('');
    setChatSending(true);
    const systemMsg = { role: 'system' as const, content: `You are a study tutor. Context: Question: "${item.question}". Student's answer: "${answer}". Keep responses clear and concise.` };
    const messages = [systemMsg, ...chatMessages, { role: 'user' as const, content: msg }];
    callOpenAIChat(messages, { maxTokens: 256 })
      .then((reply) => setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]))
      .catch(() => setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Could not get response. Try again.' }]))
      .finally(() => setChatSending(false));
  };

  const closeExplain = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setShowExplain(false);
      setChatMessages([]);
    });
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
      <Text style={styles.question}>{item.question}</Text>
      <TextInput
        style={styles.input}
        placeholder="Type your answer (1-2 sentences)..."
        placeholderTextColor="#999"
        multiline
        value={answer}
        onChangeText={setAnswer}
        editable={!currentResult}
      />
      {currentResult && !currentResult.correct && currentResult.explanation && (
        <View style={styles.explanationBox}>
          <Text style={styles.explanationText}>{currentResult.explanation}</Text>
        </View>
      )}
      {!currentResult && (
        <Pressable
          style={styles.submitBtn}
          onPress={submit}
          disabled={!answer.trim() || checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit</Text>
          )}
        </Pressable>
      )}
      {currentResult?.correct && (
        <>
          <View style={styles.resultCorrect}>
            <Ionicons name="checkmark-circle" size={32} color="#16a34a" />
            <Text style={styles.resultCorrectText}>Correct</Text>
          </View>
          <View style={styles.buttonRowCenter}>
            <Pressable style={styles.explainBtnSolo} onPress={openExplain}>
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.explainTextRow}>Explain</Text>
            </Pressable>
          </View>
        </>
      )}
      {currentResult && !currentResult.correct && (
        <>
          <View style={styles.resultWrong}>
            <Ionicons name="close-circle" size={32} color="#dc2626" />
            <Text style={styles.resultWrongText}>Incorrect</Text>
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.explainBtnRow} onPress={openExplain}>
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.explainTextRow}>Explain</Text>
            </Pressable>
            <Pressable style={styles.tryAgainBtnRow} onPress={tryAgain}>
              <Text style={styles.tryAgainTextRow}>Try again</Text>
            </Pressable>
          </View>
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
    {showExplain && (
      <>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeExplain} />
        <Animated.View
          style={[
            styles.explainPanel,
            { height: explainPanelHeight, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [explainPanelHeight, 0] }) }] },
          ]}
        >
          <View style={styles.explainHeader}>
            <Text style={styles.explainTitle}>AI Tutor</Text>
            <Pressable onPress={closeExplain} hitSlop={12}>
              <Ionicons name="close" size={24} color="#333" />
            </Pressable>
          </View>
          {chatLoading ? (
            <View style={styles.explainLoadingWrap}>
              <ActivityIndicator size="large" color={PURPLE} />
              <Text style={styles.explainLoadingText}>Getting explanation…</Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={chatScrollRef}
                style={styles.explainChat}
                contentContainerStyle={styles.explainChatContent}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {chatMessages.map((msg, i) => (
                  <View key={i} style={[styles.explainBubble, msg.role === 'user' && styles.explainBubbleUser]}>
                    <Text style={[styles.explainBubbleText, msg.role === 'user' && styles.explainBubbleTextUser]}>{msg.content}</Text>
                  </View>
                ))}
                {chatSending && (
                  <View style={[styles.explainBubble, styles.explainBubbleUser]}>
                    <ActivityIndicator size="small" color={PURPLE} />
                  </View>
                )}
              </ScrollView>
              <Pressable style={styles.explainSuggestionBtn} onPress={() => sendChat("Explain this to me like I'm 10")} disabled={chatSending}>
                <Text style={styles.explainSuggestionText}>explain this to me like I'm 10</Text>
              </Pressable>
              <View style={styles.explainInputRow}>
                <TextInput
                  style={styles.explainInput}
                  placeholder="Ask a follow-up…"
                  placeholderTextColor="#999"
                  value={chatInput}
                  onChangeText={setChatInput}
                  editable={!chatSending}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  style={[styles.explainSendBtn, (!chatInput.trim() || chatSending) && styles.explainSendBtnDisabled]}
                  onPress={() => sendChat()}
                  disabled={!chatInput.trim() || chatSending}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </>
    )}
      </View>
    </TouchableWithoutFeedback>
  );
}

async function gradeAnswer(
  question: string,
  userAnswer: string,
  expectedAnswer?: string
): Promise<Pick<GradeResult, 'correct' | 'explanation'>> {
  const systemPrompt = `You are an expert educator grading short-answer questions.
These questions expect brief, 1-2 sentence answers focusing on key facts or concepts.

Grading criteria:
- Be lenient with minor spelling/grammar issues
- Accept answers that capture the core concept, even if worded differently
- Don't require exact phrasing - focus on accuracy of the concept
- For brief answers, check if the main point is present

Return JSON in this format:
{
  "correct": true/false,
  "explanation": "Brief explanation if incorrect (1 sentence)"
}`;

  const userPrompt = `Question: ${question}
${expectedAnswer ? `Expected answer: ${expectedAnswer}` : ''}
Student answer: ${userAnswer}

Is this answer correct or close enough? Remember: this is a short-answer question expecting 1-2 sentences.`;

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
  streakCount: { fontFamily: 'FredokaOne_400Regular', fontSize: 28, color: '#1A1A1A', marginBottom: -8, marginRight: -14 },
  fireLottie: { width: 68, height: 68 },
  scroll: { flex: 1 },
  wrapContent: { paddingVertical: 24, paddingBottom: 48 },
  question: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minHeight: 90,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
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
  submitText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
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
  resultCorrectText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
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
  resultWrongText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
  tryAgainBtn: {
    backgroundColor: '#333',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  tryAgainText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
  explainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
    alignSelf: 'flex-start',
  },
  explainText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#fff' },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  buttonRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  explainBtnSolo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  tryAgainBtnRow: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tryAgainTextRow: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#fff',
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
  explainTextRow: {
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
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  explainHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  explainTitle: { fontFamily: 'Fredoka_400Regular', fontSize: 20, color: '#333' },
  explainLoadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  explainLoadingText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: PURPLE },
  explainChat: { flex: 1 },
  explainChatContent: { paddingBottom: 16, gap: 12 },
  explainBubble: { backgroundColor: '#f0f0f0', borderRadius: 16, padding: 12, maxWidth: '85%', alignSelf: 'flex-start' },
  explainBubbleUser: { backgroundColor: PURPLE, alignSelf: 'flex-end' },
  explainBubbleText: { fontFamily: 'Fredoka_400Regular', fontSize: 15, color: '#333' },
  explainBubbleTextUser: { color: '#fff' },
  explainSuggestionBtn: {
    alignSelf: 'center',
    backgroundColor: '#EEF3FF',
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
  explainSuggestionText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#444' },
  explainInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
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
  explainSendBtn: { backgroundColor: PURPLE, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  explainSendBtnDisabled: { opacity: 0.5 },
  explanationBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: RED,
  },
  explanationText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
  },
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
  counter: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#333' },
});
