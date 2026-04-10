import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const SALMON = '#FD8A8A';
const THUMB_DOWN_BG = '#E06C78';
const THUMB_UP_BG = '#8CE69C';

const CORRECT_QUIPS = ['Locked in.', 'Banked.', 'Memory strengthened.', 'Nailed it.', 'Stored.'];
const WRONG_QUIPS = ['Review mode.', 'Next time.', 'Keep going.'];

type Card = { id: string; question: string; answer: string };

type Props = {
  cards?: Card[];
  onProgressUpdate?: (correct: number, total: number) => void;
  materialId?: string;
  savedAnswers?: Record<string, 'correct' | 'incorrect'>;
  onAnswersUpdate?: (answers: Record<string, 'correct' | 'incorrect'>) => void;
  initialIndex?: number;
  displayTotal?: number;
  displayIndexMap?: Record<string, number>;
  explanations?: Record<string, string>;
};

const SCAFFOLD_CARDS: Card[] = [
  { id: 'scaffold_0', question: 'What part of the cell is responsible for producing energy?', answer: 'Mitochondria' },
  ...Array(9).fill(null).map((_, i) => ({
    id: `scaffold_${i + 1}`,
    question: `Question ${i + 2}`,
    answer: `Answer ${i + 2}`,
  })),
];

function useButtonAnim() {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const plusOpacity = useRef(new Animated.Value(0)).current;
  const plusY = useRef(new Animated.Value(0)).current;
  const plusScale = useRef(new Animated.Value(1)).current;
  const microOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  return { scale, glowOpacity, plusOpacity, plusY, plusScale, microOpacity, shakeX };
}

export function FlashcardStudy({ cards = SCAFFOLD_CARDS, onProgressUpdate, materialId, savedAnswers = {}, onAnswersUpdate, initialIndex = 0, displayTotal, displayIndexMap, explanations = {} }: Props) {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const borderW = Math.round(Math.min(width, height) * 0.018);
  const [index, setIndex] = useState(initialIndex);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, 'correct' | 'incorrect'>>(() => savedAnswers);
  const [quipUp, setQuipUp] = useState('Locked in.');
  const [quipDown, setQuipDown] = useState('Review mode.');
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [flashVisible, setFlashVisible] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState('#4ade80');
  const [streak, setStreak] = useState(0);
  const fireOpacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0.6)).current;
  const numScale = useRef(new Animated.Value(1)).current;
  const lottieRef = useRef<LottieView>(null);
  const [explainText, setExplainText] = useState('');
  const [wrongAnswered, setWrongAnswered] = useState(false);
  const explainOpacity = useRef(new Animated.Value(0)).current;
  const explainTranslateY = useRef(new Animated.Value(16)).current;

  // If wrong was pressed but explanation wasn't ready yet, animate it in when it arrives
  useEffect(() => {
    if (wrongAnswered && !explainText && card?.id && explanations[card.id]) {
      setExplainText(explanations[card.id]);
      Animated.parallel([
        Animated.timing(explainOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(explainTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [explanations, card?.id, wrongAnswered, explainText]);

  const popNumber = () => {
    numScale.setValue(1.4);
    Animated.timing(numScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const up = useButtonAnim();
  const down = useButtonAnim();

  const triggerFlash = (color: string) => {
    setFlashColor(color);
    setFlashVisible(true);
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: 900, useNativeDriver: true }).start(() => {
      setFlashVisible(false);
    });
  };

  const list = cards.length ? cards : SCAFFOLD_CARDS;
  const card = list[index];
  const total = list.length;
  const currentAnswer = answers[card.id];

  const runCorrect = () => {
    setQuipUp(CORRECT_QUIPS[Math.floor(Math.random() * CORRECT_QUIPS.length)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerFlash('#4ade80');
    setStreak((s) => {
      const next = s + 1;
      if (next >= 2) {
        const targetFireScale = Math.min(1 + (next - 2) * 0.08, 1.6);
        if (next === 2) {
          fireOpacity.setValue(1);
          fireScale.setValue(0.6);
          lottieRef.current?.play();
        }
        Animated.spring(fireScale, { toValue: targetFireScale, friction: 5, tension: 200, useNativeDriver: true }).start();
        popNumber();
        Haptics.impactAsync(next >= 5 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
      }
      return next;
    });

    // Button spring scale
    up.scale.setValue(0.9);
    Animated.spring(up.scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();

    // Glow pulse
    up.glowOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(up.glowOpacity, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(up.glowOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();

    // +1 float
    up.plusOpacity.setValue(1);
    up.plusY.setValue(0);
    up.plusScale.setValue(1);
    Animated.parallel([
      Animated.timing(up.plusY, { toValue: -36, duration: 420, useNativeDriver: true }),
      Animated.timing(up.plusScale, { toValue: 1.12, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(up.plusOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();

    // Microcopy
    up.microOpacity.setValue(0);
    Animated.sequence([
      Animated.delay(150),
      Animated.timing(up.microOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(up.microOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const runWrong = () => {
    setQuipDown(WRONG_QUIPS[Math.floor(Math.random() * WRONG_QUIPS.length)]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    triggerFlash('#ef4444');
    setStreak(0);
    Animated.timing(fireOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
      fireScale.setValue(0.6);
      numScale.setValue(1);
    });

    // Button shake
    down.scale.setValue(0.92);
    Animated.spring(down.scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();

    down.shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(down.shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(down.shakeX, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(down.shakeX, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(down.shakeX, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(down.shakeX, { toValue: 0, duration: 30, useNativeDriver: true }),
    ]).start();

    // Red glow pulse
    down.glowOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(down.glowOpacity, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(down.glowOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();

    // Microcopy
    down.microOpacity.setValue(0);
    Animated.sequence([
      Animated.delay(150),
      Animated.timing(down.microOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(down.microOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const flip = () => {
    const toValue = flipped ? 0 : 1;
    Animated.spring(flipAnim, { toValue, friction: 8, tension: 10, useNativeDriver: true }).start();
    setFlipped((f) => !f);
  };
  const resetFlip = () => {
    flipAnim.setValue(0);
    setFlipped(false);
    setExplainText('');
    setWrongAnswered(false);
    explainOpacity.setValue(0);
    explainTranslateY.setValue(16);
  };
  const next = () => { setIndex((i) => (i < total - 1 ? i + 1 : i)); resetFlip(); };

  const handleThumbsUp = () => {
    if (currentAnswer) return;
    const n = { ...answers, [card.id]: 'correct' as const };
    setAnswers(n);
    onProgressUpdate?.(Object.values(n).filter((a) => a === 'correct').length, total);
    onAnswersUpdate?.(n);
    runCorrect();
    setTimeout(() => next(), 2000);
  };

  const handleThumbsDown = () => {
    if (currentAnswer) return;
    const n = { ...answers, [card.id]: 'incorrect' as const };
    setAnswers(n);
    onProgressUpdate?.(Object.values(n).filter((a) => a === 'correct').length, total);
    onAnswersUpdate?.(n);
    runWrong();
    setWrongAnswered(true);
    const preloaded = explanations[card.id];
    if (preloaded) {
      setExplainText(preloaded);
      Animated.parallel([
        Animated.timing(explainOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(explainTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  };

  return (
    <View style={styles.wrap}>
      <Modal visible={flashVisible} transparent animationType="none" statusBarTranslucent>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: borderW, borderColor: flashColor, opacity: flashOpacity }]} />
      </Modal>
      {/* Streak fire */}
      <Animated.View pointerEvents="none" style={[styles.streakWrap, isTablet && { marginTop: 20, height: 120 }, { opacity: fireOpacity, transform: [{ scale: fireScale }] }]}>
        <Animated.Text style={[styles.streakCount, isTablet && { fontSize: 52 }, { transform: [{ scale: numScale }] }]}>{streak}</Animated.Text>
        <LottieView
          ref={lottieRef}
          source={require('../assets/Flame animation.json')}
          style={[styles.fireLottie, isTablet && { width: 120, height: 120 }]}
          loop
          autoPlay={false}
        />
      </Animated.View>

      <View style={styles.topSection}>
        <View style={[styles.cardWrap, isTablet && { height: 420, marginHorizontal: width * 0.1 }]}>
          {/* Deck cards behind */}
          <View style={[styles.card, styles.deckCard3]} />
          <View style={[styles.card, styles.deckCard2]} />
        <Pressable onPress={flip} style={StyleSheet.absoluteFill}>
          <Animated.View style={[
            styles.card, styles.cardFace,
            currentAnswer === 'correct' && styles.cardCorrect,
            currentAnswer === 'incorrect' && styles.cardIncorrect,
            isTablet && { minHeight: 400 },
            { transform: [{ rotateY: flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }], backfaceVisibility: 'hidden' },
          ]}>
            <Text style={[styles.cardText, isTablet && { fontSize: 28 }]}>{card.question}</Text>
            <Text style={[styles.flipHint, isTablet && { fontSize: 20 }]}>Tap to flip</Text>
          </Animated.View>
          <Animated.View style={[
            styles.card, styles.cardFace, styles.cardBack,
            currentAnswer === 'correct' && styles.cardCorrect,
            currentAnswer === 'incorrect' && styles.cardIncorrect,
            isTablet && { minHeight: 400 },
            { transform: [{ rotateY: flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }], backfaceVisibility: 'hidden' },
          ]}>
            <Text style={[styles.cardText, isTablet && { fontSize: 28 }]}>{card.answer}</Text>
            <Text style={[styles.flipHint, isTablet && { fontSize: 20 }]}>Tap to flip</Text>
          </Animated.View>
        </Pressable>
        </View>

        {wrongAnswered ? (
          <View>
            {explainText ? (
              <Animated.View style={[styles.explainWrap, { opacity: explainOpacity, transform: [{ translateY: explainTranslateY }] }]}>
                <Ionicons name="bulb-outline" size={16} color="#E06C78" style={{ marginRight: 6 }} />
                <Text style={styles.explainText}>{explainText}</Text>
              </Animated.View>
            ) : null}
            <Pressable style={styles.gotItBtn} onPress={next}>
              <Text style={styles.gotItText}>Got It</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />
      <View style={styles.nav}>
        {/* Thumbs Down */}
        <View style={styles.btnWrap}>
          <Animated.View style={[styles.glow, styles.glowRed, { opacity: down.glowOpacity }]} />
          <Animated.View style={{ transform: [{ scale: down.scale }, { translateX: down.shakeX }] }}>
            <Pressable onPress={handleThumbsDown} style={[styles.feedbackBtn, styles.feedbackBtnDown]} disabled={!!currentAnswer}>
              <Ionicons name="thumbs-down" size={28} color="#fff" />
            </Pressable>
          </Animated.View>
          <Animated.Text style={[styles.microText, { opacity: down.microOpacity }]}>{quipDown}</Animated.Text>
        </View>

        <Text style={styles.counter}>{displayIndexMap?.[card.id] ?? (index + 1)}/{displayTotal ?? total}</Text>

        {/* Thumbs Up */}
        <View style={styles.btnWrap}>
          <Animated.View style={[styles.glow, styles.glowGreen, { opacity: up.glowOpacity }]} />
          <Animated.View style={[styles.plusOne, { opacity: up.plusOpacity, transform: [{ translateY: up.plusY }, { scale: up.plusScale }] }]}>
            <Text style={styles.plusOneText}>+1</Text>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: up.scale }] }}>
            <Pressable onPress={handleThumbsUp} style={[styles.feedbackBtn, styles.feedbackBtnUp]} disabled={!!currentAnswer}>
              <Ionicons name="thumbs-up" size={28} color="#fff" />
            </Pressable>
          </Animated.View>
          <Animated.Text style={[styles.microText, { opacity: up.microOpacity }]}>{quipUp}</Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingVertical: 24 },
  streakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginBottom: 0,
    gap: 0,
  },
  fireLottie: {
    width: 68,
    height: 68,
  },
  streakCount: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 28,
    color: '#1A1A1A',
    marginBottom: -8,
    marginRight: -14,
  },
  topSection: { flex: 1, justifyContent: 'center' },
  cardWrap: { height: 180, marginBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckCard2: {
    position: 'absolute', top: 6, left: 6, right: -6,
    transform: [{ rotate: '2deg' }],
    backgroundColor: '#f0f0f0',
    zIndex: -1,
  },
  deckCard3: {
    position: 'absolute', top: 11, left: 10, right: -10,
    transform: [{ rotate: '4deg' }],
    backgroundColor: '#e4e4e4',
    zIndex: -2,
  },
  cardFace: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardBack: { backgroundColor: '#f0f4ff' },
  cardCorrect: { backgroundColor: '#DCFCE7' },
  cardIncorrect: { backgroundColor: '#FEE2E2' },
  cardText: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 12 },
  flipHint: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#999' },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  btnWrap: { alignItems: 'center', position: 'relative' },
  glow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    top: -12,
    left: -12,
  },
  glowGreen: { backgroundColor: '#4ade80' },
  glowRed: { backgroundColor: '#ef4444' },
  plusOne: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    zIndex: 10,
  },
  plusOneText: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 18,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  microText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    position: 'absolute',
    bottom: -18,
    left: -20,
    right: -20,
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
  feedbackText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333', flex: 0 },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: -24,
    marginTop: 16,
    marginBottom: 0,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  explainWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff0f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fdd',
  },
  explainText: {
    flex: 1,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  gotItBtn: {
    backgroundColor: SALMON,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  gotItText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    color: '#fff',
  },
});
