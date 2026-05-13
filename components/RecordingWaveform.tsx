import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const CANVAS_H = 160;
const DB_FLOOR = -45;
const RESPONSE_GAMMA = 0.55;
const HISTORY_SIZE = 120; // data points visible across the canvas width

// Builds a smooth quadratic-bezier path through the amplitude history.
// sign=-1 → top half, sign=1 → bottom half.
// scrollFrac (0–1) shifts everything left by one step-width for smooth scroll.
function buildHistoryPath(
  W: number,
  history: readonly number[],
  Ai: number,
  scrollFrac: number,
  sign: number,
): string {
  'worklet';
  const cy   = CANVAS_H * 0.5;
  const n    = history.length;
  const step = W / (n - 1);

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    xs[i] = i * step - scrollFrac * step;
    ys[i] = cy + sign * history[i] * Ai;
  }

  // Smooth quadratic bezier: midpoints are on-curve, data points are control pts.
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2;
    const my = (ys[i] + ys[i + 1]) / 2;
    d += ` Q ${xs[i].toFixed(1)},${ys[i].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  d += ` L ${xs[n - 1].toFixed(1)},${ys[n - 1].toFixed(1)}`;
  return d;
}

interface Props {
  metering: number | null;
  isPaused: boolean;
}

export function RecordingWaveform({ metering, isPaused }: Props) {
  const { width: W } = useWindowDimensions();

  // Owned on JS side to avoid stale-read races; mirrored into SV for worklets.
  const historyRef = useRef<number[]>(Array(HISTORY_SIZE).fill(0));
  const historySV  = useSharedValue<number[]>(Array(HISTORY_SIZE).fill(0));
  const scrollFrac = useSharedValue(0);
  const pausedSV   = useSharedValue(false);

  useEffect(() => { pausedSV.value = isPaused; }, [isPaused]);

  useEffect(() => {
    if (isPaused) return;

    const raw    = metering != null
      ? Math.max(0, Math.min(1, (metering - DB_FLOOR) / Math.abs(DB_FLOOR)))
      : 0;
    const shaped = Math.pow(raw, RESPONSE_GAMMA);

    // Shift history left, append new sample at the right end.
    historyRef.current = [...historyRef.current.slice(1), shaped];
    historySV.value    = historyRef.current;

    // Animate one step-width of scroll so the new sample "glides in".
    scrollFrac.value = 0;
    scrollFrac.value = withTiming(1, { duration: 130, easing: Easing.linear });
  }, [metering]);

  const Ai = CANVAS_H * 0.46;

  // Hero paths (top & bottom mirror)
  const topHero = useDerivedValue(() =>
    buildHistoryPath(W, historySV.value, Ai, scrollFrac.value, -1));
  const botHero = useDerivedValue(() =>
    buildHistoryPath(W, historySV.value, Ai, scrollFrac.value, 1));

  // Mid-weight ghost — slightly thinner, faded
  const topMid = useDerivedValue(() =>
    buildHistoryPath(W, historySV.value, Ai * 0.75, scrollFrac.value, -1));
  const botMid = useDerivedValue(() =>
    buildHistoryPath(W, historySV.value, Ai * 0.75, scrollFrac.value, 1));

  // Lightest ghost — narrowest amplitude, most transparent
  const topFade = useDerivedValue(() =>
    buildHistoryPath(W, historySV.value, Ai * 0.45, scrollFrac.value, -1));
  const botFade = useDerivedValue(() =>
    buildHistoryPath(W, historySV.value, Ai * 0.45, scrollFrac.value, 1));

  const groupOpacity = useDerivedValue(() => (pausedSV.value ? 0.4 : 1.0));

  return (
    <Canvas style={{ width: W, height: CANVAS_H }}>
      <Group opacity={groupOpacity}>
        {/* Faint outermost ghost */}
        <Path path={topFade} style="stroke" strokeWidth={0.9}  color="#000000" opacity={0.12} antiAlias />
        <Path path={botFade} style="stroke" strokeWidth={0.9}  color="#000000" opacity={0.12} antiAlias />
        {/* Mid ghost */}
        <Path path={topMid}  style="stroke" strokeWidth={1.6}  color="#000000" opacity={0.30} antiAlias />
        <Path path={botMid}  style="stroke" strokeWidth={1.6}  color="#000000" opacity={0.30} antiAlias />
        {/* Hero */}
        <Path path={topHero} style="stroke" strokeWidth={2.4}  color="#000000" opacity={0.75} antiAlias />
        <Path path={botHero} style="stroke" strokeWidth={2.4}  color="#000000" opacity={0.75} antiAlias />
      </Group>
    </Canvas>
  );
}
