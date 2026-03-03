import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMaterials } from '@/lib/study-materials-storage';
import { callOpenAI } from '@/lib/openai-service';
import type { StudyMaterialSet } from '@/lib/knowledge-graph';

const TYPEWRITER_MS = 50;
const HOLD_MS = 2000;
const ROTATING_TEXTS = [
  'Analyzing your study sessions…',
  'Finding gaps in your knowledge…',
  'Identifying concepts to review…',
];
const QUIPS: Record<'red' | 'orange' | 'green', string[]> = {
  red: [
    "You're absolutely cooked 🔥",
    "If failing was an Olympic sport, you'd be #1 🥇",
    "Stats say you should've studied yesterday. 📉",
  ],
  orange: [
    'This could go very wrong. 😬',
    'Respectfully… lock in. 🔒',
    "This is giving 'last-minute cramming' 📚",
    "Sleep? That's bold. 😴",
  ],
  green: [
    'Go to sleep. 😴',
    'You actually studied. 🤯',
    "You're good. Don't get cocky. 😎",
    'You came prepared. 🎯',
    'Calm. Collected. Passing. ✌️',
  ],
};
const getQuipTier = (pct: number): 'red' | 'orange' | 'green' =>
  pct >= 79 ? 'green' : pct >= 60 ? 'orange' : 'red';

type MethodStat = { label: string; correct: number; total: number; methodId: string };

const getGradient = (pct: number): [string, string] =>
  pct >= 79 ? ['#F6F7F9', '#22C55E'] : pct >= 60 ? ['#F6F7F9', '#F59E0B'] : ['#FFF4F4', '#D73B3B'];

const getScoreEmoji = (pct: number) =>
  pct >= 80 ? '✅' : pct >= 50 ? '⚖️' : '❌';

function buildWrongItems(m: StudyMaterialSet): string[] {
  const items: string[] = [];
  const qa = m.user_answers?.quiz_questions ?? {};
  for (const q of m.quiz_questions ?? []) {
    if (qa[q.id] === undefined || qa[q.id] !== q.correct_answer_index)
      items.push(`Q: ${q.question} (correct: ${q.options[q.correct_answer_index]})`);
  }
  const fa = m.user_answers?.flashcards ?? {};
  for (const f of m.flashcards ?? []) {
    if (fa[f.id] !== 'correct') items.push(`Flashcard: ${f.front} → ${f.back}`);
  }
  const wa = m.user_answers?.written_questions ?? {};
  for (const w of m.written_questions ?? []) {
    if (!wa[w.id]?.correct) items.push(`Written: ${w.question}`);
  }
  const fia = m.user_answers?.fill_in_blank_questions ?? {};
  for (const f of m.fill_in_blank_questions ?? []) {
    if (!fia[f.id]?.correct) items.push(`Fill-in: ${f.text} (answer: ${f.answer})`);
  }
  return items;
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { materialId } = useLocalSearchParams<{ materialId: string }>();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('Study Set');
  const [mastery, setMastery] = useState(0);
  const [methods, setMethods] = useState<MethodStat[]>([]);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [quipIndex, setQuipIndex] = useState(0);
  const lottieRef = useRef<LottieView>(null);

  // Typewriter
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const phrase = ROTATING_TEXTS[phraseIndex];

  useEffect(() => { setDisplayed(''); }, [phraseIndex]);
  useEffect(() => {
    if (!loading) return;
    if (displayed.length >= phrase.length) {
      const t = setTimeout(() => setPhraseIndex((i) => (i + 1) % ROTATING_TEXTS.length), HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDisplayed(phrase.slice(0, displayed.length + 1)), TYPEWRITER_MS);
    return () => clearTimeout(t);
  }, [displayed, phrase, loading]);

  useEffect(() => {
    if (!materialId) { setLoading(false); return; }
    (async () => {
      const m = await getMaterials(materialId);
      if (!m) { setLoading(false); return; }

      setTitle(m.title ?? 'Study Set');

      const p = m.progress ?? {};
      const stats: MethodStat[] = [];
      if (m.quiz_questions?.length) stats.push({ label: 'Multiple Choice', correct: p.multipleChoice ?? 0, total: m.quiz_questions.length, methodId: 'quiz' });
      if (m.flashcards?.length) stats.push({ label: 'Flashcards', correct: p.flashcards ?? 0, total: m.flashcards.length, methodId: 'flashcards' });
      if (m.written_questions?.length) stats.push({ label: 'Written', correct: p.written ?? 0, total: m.written_questions.length, methodId: 'written' });
      if (m.fill_in_blank_questions?.length) stats.push({ label: 'Fill in Blank', correct: p.fillInBlanks ?? 0, total: m.fill_in_blank_questions.length, methodId: 'fill' });
      setMethods(stats);

      const totalCorrect = stats.reduce((s, x) => s + x.correct, 0);
      const totalQs = stats.reduce((s, x) => s + x.total, 0);
      const pct = totalQs > 0 ? Math.min(100, Math.round((totalCorrect / totalQs) * 100)) : 0;
      setMastery(pct);
      const tierKey = getQuipTier(pct);
      setQuipIndex(Math.floor(Math.random() * QUIPS[tierKey].length));

      const wrongItems = buildWrongItems(m);
      try {
        const result = await callOpenAI<{ concepts: string[] }>(
          'You are a study coach. Given questions a student answered wrong or skipped, identify the top 3 core concepts they have not mastered. Return JSON: { "concepts": ["...", "...", "..."] } — each concept max 10 words.',
          wrongItems.length > 0
            ? `Study set: "${m.title}"\nWrong/unanswered:\n${wrongItems.slice(0, 20).join('\n')}`
            : `Study set: "${m.title}". Identify 3 foundational concepts worth reinforcing.`,
          { maxTokens: 256 }
        );
        setConcepts(Array.isArray(result.concepts) ? result.concepts.slice(0, 3) : []);
      } catch {
        setConcepts([]);
      }

      setLoading(false);
    })();
  }, [materialId]);

  const tier = getQuipTier(mastery);
  const quips = QUIPS[tier];

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>{displayed}</Text>
        <LottieView
          ref={lottieRef}
          source={require('../Happy Dog.json')}
          style={styles.lottie}
          loop
          autoPlay
        />
      </View>
    );
  }

  const [gradStart, gradEnd] = getGradient(mastery);
  const scoreColor = gradEnd;

  return (
    <LinearGradient
      colors={[gradStart, gradEnd]}
      locations={[0.35, 0.95]}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>Analysis</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.card}>
          {/* Method breakdown */}
          <Text style={styles.cardHeading}>Based on your Review</Text>
          {methods.map((stat) => {
            const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
            return (
              <Text key={stat.label} style={styles.methodLine}>
                · {stat.correct} / {stat.total} on {stat.label} {getScoreEmoji(pct)}
              </Text>
            );
          })}

          <Text style={styles.projectedLabel}>You're projected to achieve…</Text>

          {/* Big score circle */}
          <View style={styles.circleWrap}>
            <View style={styles.circle}>
              <Text style={[styles.circleText, { color: scoreColor }]}>{mastery}%</Text>
            </View>
            <Text style={[styles.quipText, { color: scoreColor }]}>{quips[quipIndex]}</Text>
          </View>

          {/* Concepts */}
          {concepts.length > 0 && (
            <>
              <Text style={styles.conceptsHeading}>Concepts you struggle with{'\n'}Include:</Text>
              {concepts.map((c, i) => (
                <Text key={i} style={styles.conceptLine}>· {c}</Text>
              ))}
            </>
          )}

          {/* Practice button */}
          <Pressable
            style={styles.practiceBtn}
            onPress={() => {
              const wrongMethods = methods
                .filter((s) => s.correct < s.total)
                .map((s) => s.methodId);
              const methodIds = wrongMethods.length > 0 ? wrongMethods : methods.map((s) => s.methodId);
              router.replace(`/generate-quiz?materialId=${materialId}&methods=${methodIds.join(',')}&wrongOnly=true`);
            }}
          >
            <Text style={styles.practiceBtnText}>Fix my Mistakes</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
    minHeight: 32,
  },
  lottie: { width: 280, height: 280 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 22,
    color: '#333',
  },
  content: { paddingHorizontal: 20, paddingTop: 8, flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 26,
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeading: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 18,
    color: '#222',
    marginBottom: 9,
  },
  methodLine: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  projectedLabel: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 17,
    color: '#222',
    marginTop: 12,
    marginBottom: 10,
  },
  circleWrap: { alignItems: 'center', marginBottom: 20 },
  circle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#F5EBE8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  circleText: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 52,
  },
  quipText: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.85,
  },
  conceptsHeading: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: 16,
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
  },
  conceptLine: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#333',
    marginBottom: 6,
  },
  practiceBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 32,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  practiceBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#fff',
  },
});
