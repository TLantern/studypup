import { callOpenAIChat, isOpenAIConfigured } from '@/lib/openai-service';
import { noteStyles, parseMarkdown } from '@/lib/notes-renderer';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const SALMON = '#FD8A8A';

type Props = { notes?: string };

const SCAFFOLD_NOTES = `## 📌 Title
Photosynthesis: Converting Light into Life

## 🧠 Core Idea
**Photosynthesis** is the fundamental biochemical process by which **green plants, algae, and some bacteria** transform **light energy** from the sun into **chemical energy** stored in **glucose (sugar)**.

## ⚙️ Key Sections
### Light-Dependent Reactions
- Explanation: Occur in the thylakoid membranes.
- Steps / Mechanism: Light absorption, water splitting, ATP production

### Calvin Cycle
- Explanation: Occurs in the stroma. Uses ATP and NADPH to fix CO2 into glucose.

## ✨ Simplified Summary
Plants use sunlight + water + CO2 to make sugar and release oxygen.

## ⭐ Why This Matters
Essential for life on Earth. Common exam topic in biology.`;

const TUTOR_SYSTEM = `You are a helpful tutor. The user is studying from the notes they will share. Your job is to:
- Answer questions about the notes clearly and concisely
- Help clarify anything unclear
- Quiz them or ask comprehension questions when appropriate
- Use student-friendly language
- Keep responses focused and not too long`;

export function TutorStudy({ notes = SCAFFOLD_NOTES }: Props) {
  const content = notes.trim() || SCAFFOLD_NOTES;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const systemContent = TUTOR_SYSTEM + '\n\nHere are the student notes:\n\n' + content;
  const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent },
    ...messages,
  ];

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!isOpenAIConfigured()) {
      Alert.alert('Tutor unavailable', 'OpenAI API key not configured.');
      return;
    }

    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const reply = await callOpenAIChat([
        ...chatMessages,
        { role: 'user', content: text },
      ]);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to get tutor response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={noteStyles.card}>{parseMarkdown(content)}</View>

        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>📝 Your turn</Text>
          <Text style={styles.promptText}>
            Answer a question about these notes, or ask if anything is unclear. Type below to chat with your tutor.
          </Text>
        </View>

        {messages.map((m, i) => (
          <View
            key={i}
            style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}
          >
            <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleText}>{m.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ActivityIndicator size="small" color="#666" />
          </View>
        )}
        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
          editable={!loading}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 16, paddingHorizontal: 4, paddingBottom: 24 },
  promptCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  promptTitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  promptText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: SALMON,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
  },
  bubbleTextUser: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#fff',
  },
  spacer: { height: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: '#F2E4E4',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SALMON,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
