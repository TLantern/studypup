import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

const SALMON = '#FD8A8A';
const THUMB_DOWN_BG = '#E06C78';
const THUMB_UP_BG = '#8CE69C';

type Card = { id: string; question: string; answer: string };

type Props = {
  cards?: Card[];
  onProgressUpdate?: (correct: number, total: number) => void;
  materialId?: string;
  savedAnswers?: Record<string, 'correct' | 'incorrect'>;
  onAnswersUpdate?: (answers: Record<string, 'correct' | 'incorrect'>) => void;
};

const SCAFFOLD_CARDS: Card[] = [
  { id: 'scaffold_0', question: 'What part of the cell is responsible for producing energy?', answer: 'Mitochondria' },
  ...Array(9).fill(null).map((_, i) => ({
    id: `scaffold_${i + 1}`,
    question: `Question ${i + 2}`,
    answer: `Answer ${i + 2}`,
  })),
];

export function FlashcardStudy({ cards = SCAFFOLD_CARDS, onProgressUpdate, materialId, savedAnswers = {}, onAnswersUpdate }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, 'correct' | 'incorrect'>>(savedAnswers);
  const [upAnim] = useState(new Animated.Value(0));
  const [downAnim] = useState(new Animated.Value(0));

  const list = cards.length ? cards : SCAFFOLD_CARDS;
  const card = list[index];
  const total = list.length;
  const currentAnswer = answers[card.id];

  useEffect(() => {
    const correct = Object.values(answers).filter((a) => a === 'correct').length;
    onProgressUpdate?.(correct, total);
    onAnswersUpdate?.(answers);
  }, [answers, total, onProgressUpdate, onAnswersUpdate]);

  useEffect(() => {
    if (currentAnswer === 'correct') {
      upAnim.setValue(1);
    } else {
      upAnim.setValue(0);
    }
    if (currentAnswer === 'incorrect') {
      downAnim.setValue(1);
    } else {
      downAnim.setValue(0);
    }
  }, [card.id, currentAnswer, upAnim, downAnim]);

  const flip = () => setFlipped((f) => !f);
  const prev = () => {
    setIndex((i) => (i > 0 ? i - 1 : i));
    setFlipped(false);
  };
  const next = () => {
    setIndex((i) => (i < total - 1 ? i + 1 : i));
    setFlipped(false);
  };

  const handleThumbsUp = () => {
    setAnswers((prev) => ({ ...prev, [card.id]: 'correct' }));
    Animated.timing(upAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  };

  const handleThumbsDown = () => {
    setAnswers((prev) => ({ ...prev, [card.id]: 'incorrect' }));
    Animated.timing(downAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  };


  return (
    <View style={styles.wrap}>
      <View style={styles.topSection}>
        <Pressable style={styles.card} onPress={flip}>
          <Text style={styles.cardText}>{flipped ? card.answer : card.question}</Text>
          <Text style={styles.flipHint}>{flipped ? 'Click to flip' : 'Click to flip'}</Text>
        </Pressable>

        <View style={styles.feedback}>
          <Pressable
            onPress={handleThumbsDown}
            style={({ pressed }) => [
              styles.feedbackBtn,
              styles.feedbackBtnDown,
              pressed && styles.feedbackBtnGlow,
            ]}
          >
            <View>
              <Ionicons name="thumbs-down" size={28} color="#fff" />
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: downAnim }]}>
                <Ionicons name="thumbs-down" size={28} color="#ef4444" />
              </Animated.View>
            </View>
          </Pressable>
          <Text style={styles.feedbackText}>Did you get this right?</Text>
          <Pressable
            onPress={handleThumbsUp}
            style={({ pressed }) => [
              styles.feedbackBtn,
              styles.feedbackBtnUp,
              pressed && styles.feedbackBtnGlow,
            ]}
          >
            <View>
              <Ionicons name="thumbs-up" size={28} color="#fff" />
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: upAnim }]}>
                <Ionicons name="thumbs-up" size={28} color="#4ade80" />
              </Animated.View>
            </View>
          </Pressable>
        </View>
        <View style={styles.divider} />
      </View>

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
  wrap: { flex: 1, paddingVertical: 24 },
  topSection: { flex: 1, justifyContent: 'center' },
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
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  feedbackBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  feedbackBtnDown: { backgroundColor: THUMB_DOWN_BG },
  feedbackBtnUp: { backgroundColor: THUMB_UP_BG },
  feedbackBtnGlow: {
    transform: [{ scale: 1.08 }],
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  feedbackText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333', flex: 0 },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    alignSelf: 'stretch',
    marginHorizontal: -24,
    marginTop: 100,
    marginBottom: 24,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
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
