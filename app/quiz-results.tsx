import { useContext, useEffect, useRef, useMemo } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function higherGrade(letter: string): string {
  const map: Record<string, string> = { F: 'B', D: 'B', C: 'A', B: 'A', A: 'A' };
  return map[letter] ?? 'A';
}

const MAX_BAR_HEIGHT = 180;

export default function QuizResultsScreen() {
  const insets = useSafeAreaInsets();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const { score: scoreParam, weak } = useLocalSearchParams<{ score: string; weak: string }>();

  const mastery = parseInt(scoreParam ?? '0', 10);
  const { projected_increase, projected_score, rightDuration } = useMemo(() => {
    // Grade-based improvement range: lower grades get bigger projected jumps
    const ranges: Record<string, [number, number]> = {
      F: [30, 38], D: [24, 30], C: [16, 22], B: [10, 15], A: [5, 8],
    };
    const letter = letterGrade(mastery);
    const [min, max] = ranges[letter];
    const inc = Math.floor(Math.random() * (max - min + 1)) + min;
    // Lower mastery = longer right bar animation (more dramatic reveal)
    const dur = mastery <= 33 ? 2800 : mastery <= 66 ? 2300 : 1800;
    return { projected_increase: inc, projected_score: Math.min(100, Math.max(80, mastery + inc)), rightDuration: dur };
  }, [mastery]);

  const weakConcept = decodeURIComponent(weak ?? 'Core concepts');
  const currentLetter = letterGrade(mastery);
  const improvedLetter = higherGrade(letterGrade(projected_score));

  const leftAnim = useRef(new Animated.Value(0)).current;
  const rightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(leftAnim, { toValue: 1, useNativeDriver: false, duration: 2000 }),
      Animated.timing(rightAnim, { toValue: 1, useNativeDriver: false, duration: rightDuration, delay: 300 }),
    ]).start();
  }, []);

  const leftHeight = leftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, (mastery / 100) * MAX_BAR_HEIGHT] });
  const rightHeight = rightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, (projected_score / 100) * MAX_BAR_HEIGHT] });

  const handleUnlock = () => {
    router.replace(superwallAvailable ? '/paywall' : '/create-account');
  };

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>Your Current Mastery: {mastery}%</Text>

        {/* Bar Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartWrap}>
            {/* Left bar */}
            <View style={styles.barGroup}>
              <View style={[styles.barTrack, { height: MAX_BAR_HEIGHT }]}>
                <Animated.View style={[styles.barFill, styles.barLeft, { height: leftHeight }]} />
              </View>
              <Text style={styles.barLabel}>Your Current{'\n'}Level</Text>
            </View>

            <View style={styles.barDivider} />

            {/* Right bar */}
            <View style={styles.barGroup}>
              <View style={{ alignItems: 'center' }}>
                <View style={styles.improvementBadge}>
                  <Text style={styles.improvementBadgeText}>+{projected_increase}% Potential</Text>
                </View>
                <View style={[styles.barTrack, { height: MAX_BAR_HEIGHT }]}>
                  <Animated.View style={[styles.barFill, styles.barRight, { height: rightHeight }]} />
                </View>
              </View>
              <Text style={styles.barLabel}>With AI-Structured{'\n'}Review</Text>
            </View>
          </View>

          {/* Score labels */}
          <View style={styles.scoreRow}>
            <Text style={styles.scoreNum}>{mastery}%</Text>
            <Text style={styles.scoreNum}>{projected_score}%</Text>
          </View>
        </View>

        {/* Insight card */}
        <View style={styles.insightCard}>
          {currentLetter === 'A' ? (
            <>
              <Text style={styles.insightText}>
                You're already on the right track — seriously, <Text style={styles.bold}>nice work</Text>.
              </Text>
              <Text style={styles.insightText}>
                The goal now is keeping it there. Consistent review is what separates a <Text style={styles.bold}>one-time A</Text> from always getting one.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.insightText}>
                You're currently on track for a <Text style={styles.bold}>{currentLetter}</Text>.
              </Text>
              <Text style={styles.insightText}>
                Your biggest gap is <Text style={styles.bold}>{weakConcept}</Text> — this is likely costing you points on every exam that tests it.
              </Text>
              <Text style={styles.insightText}>
                With structured review, you could reach a <Text style={styles.bold}>{improvedLetter}</Text>.
              </Text>
            </>
          )}
        </View>

        <View style={styles.ctaWrap}>
          <Pressable style={styles.btn} onPress={handleUnlock}>
            <Text style={styles.btnText}>Increase My Score</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  headline: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(26),
    color: '#000',
    textAlign: 'center',
    marginBottom: scaleSize(28),
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(20),
    padding: scaleSize(20),
    marginBottom: scaleSize(16),
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: scaleSize(24),
    marginBottom: scaleSize(12),
  },
  barGroup: { alignItems: 'center', gap: scaleSize(10) },
  barTrack: {
    width: scaleSize(80),
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: scaleSize(10),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: scaleSize(10) },
  barLeft: { backgroundColor: '#AADDDD' },
  barRight: { backgroundColor: '#FD8A8A' },
  barDivider: { width: 1, height: MAX_BAR_HEIGHT, backgroundColor: 'transparent' },
  barLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(13),
    color: '#444',
    textAlign: 'center',
    lineHeight: scaleFont(18),
  },
  improvementBadge: {
    backgroundColor: '#F5A623',
    borderRadius: scaleSize(20),
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(5),
    marginBottom: scaleSize(6),
    alignSelf: 'center',
  },
  improvementBadgeText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(12),
    color: '#fff',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 0,
    paddingHorizontal: scaleSize(20),
  },
  scoreNum: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(20),
    color: '#333',
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(16),
    padding: scaleSize(20),
    marginBottom: scaleSize(28),
    gap: scaleSize(10),
    shadowColor: '#333',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  insightText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(16),
    color: '#333',
    lineHeight: scaleFont(22),
  },
  bold: { fontFamily: 'FredokaOne_400Regular', color: '#111' },
  ctaWrap: { marginBottom: scaleSize(-34) },
  btn: {
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 10,
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
});
