import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const SALMON = '#FD8A8A';

type Item = { text: string };

type Props = { items?: Item[] };

const SCAFFOLD_ITEMS: Item[] = [
  {
    text: 'The human immune system protects the body from harmful pathogens and foreign substances. It relies on a complex network of cells, tissues, and organs to defend against threats. One of the most important types of cells in this system is the ___, which can recognize and destroy infected or cancerous cells.',
  },
  ...Array(9).fill(null).map((_, i) => ({ text: `Fill in the blank question ${i + 2}: The answer is ___.` })),
];

export function FillInBlankStudy({ items = SCAFFOLD_ITEMS }: Props) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');

  const list = items.length ? items : SCAFFOLD_ITEMS;
  const item = list[index];
  const total = list.length;

  const submit = () => { /* scaffold */ };
  const prev = () => {
    setIndex((i) => (i > 0 ? i - 1 : i));
    setAnswer('');
  };
  const next = () => {
    setIndex((i) => (i < total - 1 ? i + 1 : i));
    setAnswer('');
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.wrapContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.questionText}>{item.text}</Text>
        <TextInput
          style={styles.input}
          placeholder="Type your answer here"
          placeholderTextColor="#999"
          value={answer}
          onChangeText={setAnswer}
        />
      </View>
      <Pressable style={styles.submitBtn} onPress={submit}>
        <Text style={styles.submitText}>Submit</Text>
      </Pressable>
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

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  wrapContent: { paddingVertical: 24, paddingBottom: 48 },
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 24,
  },
  questionText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFEDED',
    borderRadius: 12,
    padding: 16,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#333',
    marginBottom: 0,
  },
  submitBtn: {
    backgroundColor: SALMON,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#fff' },
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
