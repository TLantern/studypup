import { callOpenAIChat, isOpenAIConfigured } from '@/lib/openai-service';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#0D0D0F';
const BLUE = '#3B82F6';
const BG = '#F8F9FB';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  { emoji: '✅', label: 'Key decisions' },
  { emoji: '📧', label: 'Follow-up email' },
  { emoji: '📋', label: 'Action items' },
  { emoji: '⚡', label: '3-bullet summary' },
  { emoji: '🔍', label: 'Open questions' },
];

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

interface Props {
  visible: boolean;
  onClose: () => void;
  notes: string;
  title: string;
}

export function NotarioChatModal({ visible, onClose, notes, title }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    scrollToBottom();
    setLoading(true);

    try {
      const systemPrompt = `You are Notario, a sharp and efficient professional assistant.\nThe user's meeting note titled "${title}" is below.\nAnswer concisely — 1–3 sentences unless depth is explicitly requested.\nUse plain business language: no filler, no fluff, no pleasantries.\nLead with the answer, not the context.\nIf asked to extract action items, decisions, or next steps, return a clean bulleted list.\n\n---\n${notes || 'No notes provided yet.'}`;
      const history = next.map((m) => ({ role: m.role, content: m.content }));
      let reply: string;
      if (isOpenAIConfigured()) {
        reply = await callOpenAIChat([{ role: 'system', content: systemPrompt }, ...history]);
      } else {
        reply = `Notario here. OpenAI isn't configured — connect an API key to enable responses for "${title}".`;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const AiAvatar = () => (
    <LinearGradient
      colors={['#FFFFFF', '#C7D9F8', '#3B82F6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.aiDot}
    />
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {!isUser && <AiAvatar />}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={16} style={styles.closeBtn}>
            <Ionicons name="chevron-down" size={22} color="#6B7280" />
          </Pressable>
          <View style={styles.headerCenter}>
            <LinearGradient
              colors={['#FFFFFF', '#C7D9F8', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerDot}
            />
            <Text style={styles.headerTitle}>Notario</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.divider} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.introWrap}>
                <AiAvatar />
                <View style={styles.introCard}>
                  <Text style={styles.introName}>Notario</Text>
                  <Text style={styles.introText}>
                    Ask me anything about{' '}
                    <Text style={styles.bold}>{title}</Text>
                    {'. I\'ll keep it sharp.'}
                  </Text>
                </View>
              </View>
            }
            ListFooterComponent={
              loading ? (
                <View style={[styles.msgRow, styles.msgRowAI]}>
                  <AiAvatar />
                  <View style={[styles.bubbleAI, styles.loadingBubble]}>
                    <View style={styles.typingDots}>
                      <View style={[styles.dot, { opacity: 0.4 }]} />
                      <View style={[styles.dot, { opacity: 0.7 }]} />
                      <View style={styles.dot} />
                    </View>
                  </View>
                </View>
              ) : null
            }
          />

          {/* Suggestion chips */}
          {messages.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsWrap}
              contentContainerStyle={styles.suggestions}
            >
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s.label}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                  onPress={() => send(s.label)}
                >
                  <Text style={styles.chipEmoji}>{s.emoji}</Text>
                  <Text style={styles.chipText}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Input */}
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask Notario..."
              placeholderTextColor="#9CA3AF"
              multiline
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => send(input)}
              disabled={!input.trim() || loading}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerTitle: {
    fontFamily: SF_PRO,
    fontSize: 17,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: -0.3,
  },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },

  // Messages
  messageList: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },

  aiDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    flexShrink: 0,
    overflow: 'hidden',
  },

  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleAI: {
    maxWidth: '78%',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: BLUE,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontFamily: SF_PRO,
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
  },
  bubbleTextUser: { color: '#fff' },
  bold: { fontWeight: '700' },

  // Loading
  loadingBubble: { paddingVertical: 12, paddingHorizontal: 16 },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BLUE,
  },

  // Intro
  introWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  introCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  introName: {
    fontFamily: SF_PRO,
    fontSize: 12,
    fontWeight: '700',
    color: BLUE,
    marginBottom: 3,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  introText: {
    fontFamily: SF_PRO,
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
  },

  // Chips
  suggestionsWrap: { flexGrow: 0, flexShrink: 0, backgroundColor: BG },
  suggestions: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  chipPressed: { opacity: 0.7 },
  chipEmoji: { fontSize: 14 },
  chipText: { fontFamily: SF_PRO, fontSize: 13, color: '#374151', fontWeight: '500' },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: SF_PRO,
    fontSize: 15,
    color: '#111',
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
});
