import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const SALMON = '#FD8A8A';

type Card = { question: string; answer: string };

type Props = {
  cards?: Card[];
};

const SCAFFOLD_CARDS: Card[] = [
  { question: 'What part of the cell is responsible for producing energy?', answer: 'Mitochondria' },
  ...Array(9).fill(null).map((_, i) => ({
    question: `Question ${i + 2}`,
    answer: `Answer ${i + 2}`,
  })),
];

export function FlashcardStudy({ cards = SCAFFOLD_CARDS }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const list = cards.length ? cards : SCAFFOLD_CARDS;
  const card = list[index];
  const total = list.length;

  const flip = () => setFlipped((f) => !f);
  const prev = () => {
    setIndex((i) => (i > 0 ? i - 1 : i));
    setFlipped(false);
  };
  const next = () => {
    setIndex((i) => (i < total - 1 ? i + 1 : i));
    setFlipped(false);
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.card} onPress={flip}>
        <Text style={styles.cardText}>{flipped ? card.answer : card.question}</Text>
        <Text style={styles.flipHint}>{flipped ? 'Click to flip' : 'Click to flip'}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  flipHint: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#999' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
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
