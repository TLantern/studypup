import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { OnboardingProgressRow } from '@/components/OnboardingProgressRow';
import { hapticContinue } from '@/lib/haptics';
import { trackPageViewed } from '@/lib/analytics';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont, scaleVertical } from '@/lib/responsive';

// Normalized [x, y]: x 0→1 left→right, y 0→1 bottom→top
const COCO_POINTS: [number, number][] = [
  [0.00, 0.04],
  [0.15, 0.08],
  [0.30, 0.14],
  [0.42, 0.22],
  [0.52, 0.34],
  [0.62, 0.50],
  [0.72, 0.64],
  [0.82, 0.76],
  [0.92, 0.86],
  [1.00, 0.92],
];

const SELF_POINTS: [number, number][] = [
  [0.00, 0.04],
  [0.20, 0.06],
  [0.38, 0.05],
  [0.55, 0.08],
  [0.70, 0.07],
  [0.85, 0.11],
  [1.00, 0.13],
];

const CHART_W = 300;
const CHART_H = 180;

function Segment({ x1, y1, x2, y2, color, strokeWidth = 3 }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; strokeWidth?: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: cx - length / 2,
        top: cy - strokeWidth / 2,
        width: length,
        height: strokeWidth,
        backgroundColor: color,
        borderRadius: strokeWidth,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function ChartLine({ points, color, strokeWidth = 3 }: {
  points: [number, number][];
  color: string;
  strokeWidth?: number;
}) {
  return (
    <>
      {points.slice(0, -1).map((pt, i) => {
        const x1 = pt[0] * CHART_W;
        const y1 = (1 - pt[1]) * CHART_H;
        const x2 = points[i + 1][0] * CHART_W;
        const y2 = (1 - points[i + 1][1]) * CHART_H;
        return <Segment key={i} x1={x1} y1={y1} x2={x2} y2={y2} color={color} strokeWidth={strokeWidth} />;
      })}
      {/* Filled circles at each joint to hide segment gaps */}
      {points.map((pt, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: pt[0] * CHART_W - strokeWidth / 2,
            top: (1 - pt[1]) * CHART_H - strokeWidth / 2,
            width: strokeWidth,
            height: strokeWidth,
            borderRadius: strokeWidth,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
}

const GRID_LINES = 5;

export default function GpaProjectionScreen() {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    trackPageViewed('ob_gpa_projection');
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <OnboardingView header={<OnboardingProgressRow progress={0.92} />}>
      <View style={styles.container}>
        <View style={styles.content}>
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.headline}>You took the first step!</Text>
          <Text style={styles.body}>
            With regular effort, Notario helps you{'\n'}achieve long-term progress.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your GPA</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: ACCENT_BLUE }]} />
                <Text style={styles.legendLabel}>with Notario</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#C4C4C4' }]} />
                <Text style={[styles.legendLabel, { color: '#A0A0A0' }]}>self-study</Text>
              </View>
            </View>
          </View>

          <View style={styles.chartContainer}>
            {/* Grid lines */}
            {Array.from({ length: GRID_LINES }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.gridLine,
                  { top: (i / (GRID_LINES - 1)) * CHART_H },
                ]}
              />
            ))}

            {/* Chart lines */}
            <ChartLine points={SELF_POINTS} color="#C4C4C4" strokeWidth={2.5} />
            <ChartLine points={COCO_POINTS} color={ACCENT_BLUE} strokeWidth={3.5} />
          </View>
        </Animated.View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + scaleSize(16) }]}>
          <Pressable
            style={styles.btn}
            onPress={() => { hapticContinue(); router.push('/creating-plan'); }}
          >
            <Text style={styles.btnText}>Continue →</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scaleSize(24),
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingTop: scaleVertical(8),
    paddingBottom: scaleVertical(24),
  },
  headline: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: ACCENT_BLUE,
    textAlign: 'center',
    marginBottom: scaleSize(8),
  },
  body: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: DEEP_BLACK,
    textAlign: 'center',
    lineHeight: scaleFont(24),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaleSize(20),
    padding: scaleSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSize(16),
  },
  cardTitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: DEEP_BLACK,
  },
  legend: {
    flexDirection: 'row',
    gap: scaleSize(12),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(5),
  },
  legendDot: {
    width: scaleSize(8),
    height: scaleSize(8),
    borderRadius: scaleSize(4),
  },
  legendLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    fontWeight: '500',
    color: DEEP_BLACK,
  },
  chartContainer: {
    width: CHART_W,
    height: CHART_H,
    alignSelf: 'center',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
  },
  footer: {
    paddingTop: scaleSize(12),
  },
  btn: sharedStyles.continueBtn,
  btnText: sharedStyles.continueBtnText,
});
