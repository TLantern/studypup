import { callOpenAIChat, isOpenAIConfigured } from '@/lib/openai-service';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { SF_PRO } from '@/lib/onboarding-theme';

const PURPLE = '#7FA8FF';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Summarise the key points',
  'What should I focus on?',
  'Give me a quick quiz',
  'Explain this simply',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  notes: string;
  title: string;
}

export function ChatModal({ visible, onClose, notes, title }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  const introText = `My name's Andrew — but you can call me Drew 😏 You've got good taste studying this. Ask me anything and I'll make sure it all clicks.`;

  useEffect(() => {
    if (visible) {
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [visible]);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
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
      const systemPrompt = `You are a charming, confident tutor with a natural tutor-student dynamic. The student's notes on "${title}" are below. Keep ALL responses to 3 short sentences or fewer unless asked for more. Occasionally slip in a subtle compliment or playful remark — never over the top, always smooth.\n\n---\n${notes || 'No notes provided yet.'}`;
      const history = next.map((m) => ({ role: m.role, content: m.content }));
      let reply: string;
      if (isOpenAIConfigured()) {
        reply = await callOpenAIChat([{ role: 'system', content: systemPrompt }, ...history]);
      } else {
        reply = `I'm Notario! I'd love to help with "${title}". (OpenAI not configured — connect an API key to enable real responses.)`;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Oops, something went wrong. Try again!' }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowPup]}>
        {!isUser && (
          <Image source={require('../assets/puppy.png')} style={styles.avatar} />
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubblePup]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color="#333" />
          </Pressable>
          <Text style={styles.headerTitle}>Chat with notes</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.divider} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          <FlatList
            ref={listRef}
            data={[...messages].reverse()}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            inverted
            ListHeaderComponent={
              loading ? (
                <View style={[styles.msgRow, styles.msgRowPup]}>
                  <Image source={require('../assets/puppy.png')} style={styles.avatar} />
                  <View style={[styles.bubblePup, styles.loadingBubble]}>
                    <ActivityIndicator size="small" color={PURPLE} />
                  </View>
                </View>
              ) : null
            }
            ListFooterComponent={
              <View style={styles.msgRow}>
                <Image source={require('../assets/puppy.png')} style={styles.avatar} />
                <View style={styles.bubblePup}>
                  <Text style={styles.bubbleText}>{introText}</Text>
                </View>
              </View>
            }
          />

          {/* Suggestions */}
          {messages.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsWrap}
              contentContainerStyle={styles.suggestions}
            >
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                  <Text style={styles.chipText}>{s}</Text>
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
              placeholder="Ask a follow-up question..."
              placeholderTextColor="#aaa"
              multiline
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: { fontFamily: SF_PRO, fontSize: 20, color: '#000' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  messageList: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, gap: 14 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowPup: { justifyContent: 'flex-start' },
  avatar: { width: 34, height: 34, borderRadius: 17, flexShrink: 0 },
  bubble: {
    maxWidth: '75%',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubblePup: {
    maxWidth: '75%',
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: PURPLE,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontFamily: SF_PRO, fontSize: 15, color: '#222', lineHeight: 21 },
  bubbleTextUser: { color: '#fff' },
  loadingBubble: { paddingVertical: 14, paddingHorizontal: 20 },
  suggestionsWrap: { flexGrow: 0, flexShrink: 0 },
  suggestions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  chipText: { fontFamily: SF_PRO, fontSize: 13, color: PURPLE },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: SF_PRO,
    fontSize: 15,
    color: '#222',
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
});
