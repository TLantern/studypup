import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { callOpenAI, callOpenAIChat } from '@/lib/openai-service';

const SALMON = '#FD8A8A';
const GREEN = '#BCFFC0';
const RED = '#EA898B';
const PURPLE = '#7c3aed';

type Item = { id: string; text: string; answer: string };

type Props = {
  items?: Item[];
  onProgressUpdate?: (correct: number, total: number) => void;
  materialId?: string;
  savedAnswers?: Record<string, { answer: string; correct: boolean; explanation?: string }>;
  onAnswersUpdate?: (answers: Record<string, { answer: string; correct: boolean; explanation?: string }>) => void;
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

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function FillInBlankStudy({ items = SCAFFOLD_ITEMS, onProgressUpdate, materialId, savedAnswers = {}, onAnswersUpdate }: Props) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<Record<string, { answer: string; correct: boolean; explanation?: string }>>(savedAnswers);
  const [checking, setChecking] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const list = items.length ? items : SCAFFOLD_ITEMS;
  const item = list[index];
  const total = list.length;
  const currentResult = results[item.id];

  useEffect(() => {
    if (Object.keys(savedAnswers).length > 0) setResults(savedAnswers);
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
  }, [results, total, onProgressUpdate, onAnswersUpdate]);

  const submit = async () => {
    if (!answer.trim() || checking || currentResult) return;
    
    setChecking(true);
    try {
      const result = await gradeAnswer(item.text, answer, item.answer);
      setResults((prev) => ({ ...prev, [item.id]: { answer, ...result } }));
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

  const openExplain = async () => {
    setShowExplain(true);
    setChatMessages([]);
    setChatLoading(true);
    try {
      const systemPrompt = `You are a helpful tutor explaining answers to students. 
Be clear, concise, and encouraging. Break down concepts into simple terms.
Start by greeting the student and explaining the answer to their question.`;
      
      const userPrompt = `Fill-in-the-blank question: ${item.text}
Student's answer: ${answer}
Expected answer: ${item.answer}
${currentResult?.explanation ? `Why it was incorrect: ${currentResult.explanation}` : ''}

Please explain the correct answer and help the student understand why their response was ${currentResult?.correct ? 'correct' : 'incorrect'}.`;

      const initialResponse = await callOpenAIChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      setChatMessages([
        { role: 'assistant', content: initialResponse },
      ]);
    } catch (error) {
      console.error('Failed to get explanation:', error);
      setChatMessages([
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const systemPrompt = `You are a helpful tutor. The student is asking about this fill-in-the-blank question: "${item.text}". 
Keep your responses clear, concise, and educational.`;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userMessage },
      ];

      const response = await callOpenAIChat(messages);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Failed to send chat:', error);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const closeExplain = () => {
    setShowExplain(false);
    setChatMessages([]);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.wrapContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.question}>{item.text}</Text>
      <TextInput
        style={styles.input}
        placeholder="Type your answer here"
        placeholderTextColor="#999"
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
          <Pressable style={styles.tryAgainBtn} onPress={tryAgain}>
            <Text style={styles.tryAgainText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.explainBtn} onPress={openExplain}>
            <Text style={styles.explainText}>Explain</Text>
          </Pressable>
        </>
      )}
      
      <Modal visible={showExplain} animationType="slide" transparent onRequestClose={closeExplain}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.explainCard}>
            <View style={styles.explainHeader}>
              <Text style={styles.explainHeaderText}>AI Tutor</Text>
              <Pressable onPress={closeExplain} hitSlop={12}>
                <Ionicons name="close" size={28} color="#333" />
              </Pressable>
            </View>
            
            <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
              {chatMessages.length === 0 && chatLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={PURPLE} />
                  <Text style={styles.loadingText}>AI Tutor is thinking...</Text>
                </View>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <View key={i} style={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                      <Text style={msg.role === 'user' ? styles.userMessageText : styles.assistantMessageText}>
                        {msg.content}
                      </Text>
                    </View>
                  ))}
                  {chatLoading && chatMessages.length > 0 && (
                    <View style={styles.assistantMessage}>
                      <ActivityIndicator color={PURPLE} />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Ask a follow-up question..."
                placeholderTextColor="#999"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={sendChat}
                returnKeyType="send"
              />
              <Pressable style={styles.chatSendBtn} onPress={sendChat} disabled={!chatInput.trim() || chatLoading}>
                <Ionicons name="send" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      <View style={styles.nav}>
        <Pressable onPress={prev} style={styles.navBtn} disabled={index === 0}>
          <Ionicons name="chevron-back" size={24} color={index === 0 ? '#999' : '#fff'} />
        </Pressable>
        <Text style={styles.counter}>{index + 1}/{total}</Text>
        <Pressable onPress={next} style={styles.navBtn} disabled={index === total - 1}>
          <Ionicons name="chevron-forward" size={24} color={index === total - 1 ? '#999' : '#fff'} />
        </Pressable>
      </View>
    </ScrollView>
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
    fontFamily: 'Fredoka_400Regular',
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
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  explainText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  explainCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 20,
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  explainHeaderText: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 20,
    color: '#333',
  },
  chatScroll: { flex: 1 },
  chatContent: { padding: 20, paddingBottom: 32 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: PURPLE,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessageText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#fff',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  assistantMessageText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
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
