import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const SALMON = '#FD8A8A';

type Item = { question: string };

type Props = { items?: Item[] };

const SCAFFOLD_ITEMS: Item[] = [
  { question: 'What part of the cell is responsible for producing energy?' },
  ...Array(9).fill(null).map((_, i) => ({ question: `Question ${i + 2}` })),
];

export function WrittenStudy({ items = SCAFFOLD_ITEMS }: Props) {
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
      <Text style={styles.question}>{item.question}</Text>
      <TextInput
        style={styles.input}
        placeholder="Type your answer here..."
        placeholderTextColor="#999"
        multiline
        value={answer}
        onChangeText={setAnswer}
      />
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
    minHeight: 120,
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
