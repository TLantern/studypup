import { useContext, useEffect, useRef, useMemo } from 'react';
import { Animated, Easing, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { scaleFont, scaleSize } from '@/lib/responsive';
import { trackPageViewed, trackEvent } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';
import { OnboardingView } from '@/components/OnboardingView';
import { DEEP_BLACK, OFF_WHITE, ACCENT_BLUE, SUBTITLE_GRAY, MUTED_TEXT, CARD_SHADOW, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';

const MAX_BAR_HEIGHT = scaleSize(180);

const COLOR_GREEN = '#4CD964';
const COLOR_GOLD  = '#FFD700';
const COLOR_RED   = '#FF5F5F';
const COLOR_AMBER = '#FFBB33';

function currentBarColor(score: number): string {
  if (score === 100) return COLOR_GREEN;
  if (score >= 60)   return COLOR_AMBER;
  return COLOR_RED;
}

function structuredBarColor(score: number): string {
  return score === 100 ? COLOR_GOLD : COLOR_GREEN;
}

function badgeColor(score: number): string {
  return score === 100 ? COLOR_GOLD : COLOR_GREEN;
}

function bgTint(score: number): string {
  if (score === 100) return '#FFE680';
  if (score >= 80) return '#A8E5B5';
  if (score >= 60) return '#FFD27A';
  return '#FF9F9F';
}

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

export default function QuizResultsScreen() {
  const insets = useSafeAreaInsets();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const { score: scoreParam, weak } = useLocalSearchParams<{ score: string; weak: string }>();

  useEffect(() => {
    trackPageViewed('ob_student_quiz_results');
    trackEvent('ob_student_quiz_completed', { score: mastery, grade: letterGrade(mastery), weak_concept: weak ?? null });
  }, []);

  const mastery = parseInt(scoreParam ?? '0', 10);
  const { projected_increase, projected_score } = useMemo(() => {
    const ranges: Record<string, [number, number]> = {
      F: [30, 38], D: [24, 30], C: [16, 22], B: [10, 15], A: [5, 8],
    };
    const letter = letterGrade(mastery);
    const [min, max] = ranges[letter];
    const inc = Math.floor(Math.random() * (max - min + 1)) + min;
    return { projected_increase: inc, projected_score: Math.min(100, Math.max(80, mastery + inc)) };
  }, [mastery]);

  const weakConcept = decodeURIComponent(weak ?? 'Core concepts');
  const currentLetter = letterGrade(mastery);
  const improvedLetter = higherGrade(letterGrade(projected_score));

  const leftAnim = useRef(new Animated.Value(0)).current;
  const rightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const cfg = { toValue: 1, useNativeDriver: true, duration: 1200, easing: Easing.out(Easing.ease) };
    Animated.parallel([
      Animated.timing(leftAnim, cfg),
      Animated.timing(rightAnim, cfg),
    ]).start();
  }, []);

  const leftH = (mastery / 100) * MAX_BAR_HEIGHT;
  const rightH = (projected_score / 100) * MAX_BAR_HEIGHT;
  const leftTranslateY = leftAnim.interpolate({ inputRange: [0, 1], outputRange: [leftH / 2, 0] });
  const rightTranslateY = rightAnim.interpolate({ inputRange: [0, 1], outputRange: [rightH / 2, 0] });

  const leftColor = currentBarColor(mastery);
  const rightColor = structuredBarColor(mastery);
  const badgeBg = badgeColor(mastery);

  return (
    <OnboardingView>
      <View style={styles.bg}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', bgTint(mastery)]}
          locations={[0, 1]}
          style={styles.gradient}
        />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(32) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline}>Your Current Mastery: {mastery}%</Text>

        <View style={styles.card}>
          <View style={styles.chartWrap}>
            <View style={styles.barGroup}>
              <View style={[styles.barTrack, { height: MAX_BAR_HEIGHT }]}>
                <Animated.View style={[styles.barFill, { backgroundColor: leftColor, height: leftH, transform: [{ scaleY: leftAnim }, { translateY: leftTranslateY }] }]} />
              </View>
              <Text style={styles.barLabel}>Your Current{'\n'}Level</Text>
            </View>

            <View style={styles.barDivider} />

            <View style={styles.barGroup}>
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={styles.badgeText}>+{projected_score - mastery}% Potential</Text>
                </View>
                <View style={[styles.barTrack, { height: MAX_BAR_HEIGHT }]}>
                  <Animated.View style={[styles.barFill, { backgroundColor: rightColor, height: rightH, transform: [{ scaleY: rightAnim }, { translateY: rightTranslateY }] }]} />
                </View>
              </View>
              <Text style={styles.barLabel}>With AI-Structured{'\n'}Review</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreNum}>{mastery}%</Text>
            <Text style={styles.scoreNum}>{projected_score}%</Text>
          </View>
        </View>

        <View style={styles.insightCard}>
          {currentLetter === 'A' ? (
            <>
              <Text style={styles.insightText}>
                You're already on the right track — seriously, <Text style={styles.bold}>nice work</Text>.
              </Text>
              <Text style={styles.insightText}>
                Consistent review is what separates a <Text style={styles.bold}>one-time A</Text> from always getting one.
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

        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={() => { hapticContinue(); router.replace(superwallAvailable ? '/paywall' : '/create-account'); }}
        >
          <Text style={styles.ctaBtnText}>Increase My Score</Text>
        </Pressable>
      </ScrollView>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#FFFFFF' },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  container: { paddingHorizontal: scaleSize(24) },
  headline: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: DEEP_BLACK,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: scaleSize(24),
  },
  card: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(8),
    padding: scaleSize(20),
    marginBottom: scaleSize(16),
    ...CARD_SHADOW,
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
    borderRadius: scaleSize(6),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: scaleSize(6) },
  barDivider: { width: 1, height: MAX_BAR_HEIGHT },
  barLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    fontWeight: '500',
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    lineHeight: scaleFont(18),
  },
  badge: {
    borderRadius: scaleSize(20),
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(5),
    marginBottom: scaleSize(6),
  },
  badgeText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: scaleSize(20),
  },
  scoreNum: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  insightCard: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(8),
    padding: scaleSize(20),
    marginBottom: scaleSize(28),
    gap: scaleSize(10),
    ...CARD_SHADOW,
  },
  insightText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
    lineHeight: scaleFont(23),
  },
  bold: {
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  ctaBtn: { ...sharedStyles.continueBtn, backgroundColor: DEEP_BLACK },
  ctaBtnText: sharedStyles.continueBtnText,
});
