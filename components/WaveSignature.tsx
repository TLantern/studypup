import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SILVER_LIGHT = '#EEF0F3';
const SILVER = '#C9CCD1';
const SILVER_DEEP = '#8A8E96';
const ACCENT_BLUE = '#7FA8FF';
const ACCENT_BLUE_SOFT = 'rgba(127, 168, 255, 0.35)';

type Layer = {
  topPct: number;
  widthMult: number;
  height: number;
  leftPct: number;
  amplitude: number;
  driftX: number;
  duration: number;
  phase: number;
  colors: string[];
  locations: number[];
  opacity: number;
};

const LAYERS: Layer[] = [
  {
    topPct: 0.12,
    widthMult: 2.6,
    height: 460,
    leftPct: -0.85,
    amplitude: 14,
    driftX: 18,
    duration: 8200,
    phase: 0,
    colors: [SILVER_LIGHT, SILVER, SILVER_DEEP, SILVER, SILVER_LIGHT],
    locations: [0, 0.32, 0.5, 0.68, 1],
    opacity: 0.95,
  },
  {
    topPct: 0.28,
    widthMult: 2.3,
    height: 420,
    leftPct: -0.65,
    amplitude: 18,
    driftX: -22,
    duration: 9600,
    phase: Math.PI * 0.5,
    colors: [SILVER, ACCENT_BLUE_SOFT, SILVER_LIGHT, ACCENT_BLUE_SOFT, SILVER],
    locations: [0, 0.28, 0.5, 0.72, 1],
    opacity: 0.9,
  },
  {
    topPct: 0.44,
    widthMult: 2.4,
    height: 440,
    leftPct: -0.7,
    amplitude: 20,
    driftX: 26,
    duration: 10800,
    phase: Math.PI,
    colors: [SILVER_DEEP, SILVER, SILVER_LIGHT, SILVER, SILVER_DEEP],
    locations: [0, 0.3, 0.5, 0.7, 1],
    opacity: 0.92,
  },
  {
    topPct: 0.6,
    widthMult: 2.5,
    height: 420,
    leftPct: -0.78,
    amplitude: 16,
    driftX: -16,
    duration: 9000,
    phase: Math.PI * 1.4,
    colors: [SILVER, SILVER_LIGHT, ACCENT_BLUE, SILVER_LIGHT, SILVER],
    locations: [0, 0.36, 0.5, 0.64, 1],
    opacity: 0.88,
  },
  {
    topPct: 0.78,
    widthMult: 2.2,
    height: 380,
    leftPct: -0.6,
    amplitude: 12,
    driftX: 20,
    duration: 11400,
    phase: Math.PI * 0.25,
    colors: [SILVER_DEEP, SILVER, SILVER_DEEP, SILVER, SILVER_DEEP],
    locations: [0, 0.3, 0.5, 0.7, 1],
    opacity: 0.85,
  },
];

type Props = {
  width: number;
  height: number;
  style?: ViewStyle;
};

export function WaveSignature({ width, height, style }: Props) {
  return (
    <View
      style={[
        { width, height, overflow: 'hidden' },
        style,
      ]}
      pointerEvents="none"
    >
      {LAYERS.map((layer, i) => (
        <WaveLayer key={i} layer={layer} containerWidth={width} containerHeight={height} />
      ))}
      <LinearGradient
        colors={['rgba(247,247,245,1)', 'rgba(247,247,245,0)', 'rgba(247,247,245,0)']}
        locations={[0, 0.32, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

function WaveLayer({
  layer,
  containerWidth,
  containerHeight,
}: {
  layer: Layer;
  containerWidth: number;
  containerHeight: number;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: layer.duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [layer.duration, t]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const angle = t.value * Math.PI * 2 + layer.phase;
    return {
      transform: [
        { translateY: Math.sin(angle) * layer.amplitude },
        { translateX: Math.cos(angle * 0.5) * layer.driftX },
      ],
    };
  });

  const w = containerWidth * layer.widthMult;
  const left = containerWidth * layer.leftPct;
  const top = containerHeight * layer.topPct;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: w,
          height: layer.height,
          left,
          top,
          borderRadius: 9999,
          overflow: 'hidden',
          opacity: layer.opacity,
        },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={layer.colors as any}
        locations={layer.locations as any}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
