import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const IDLE_CIRCLE_RADIUS = 10;
const IDLE_CIRCLE_DURATION = 4000;
const IDLE_SCALE_DELTA = 0.02;
const TWO_PI = 2 * Math.PI;

export function useHoverFloatStyle() {
  const idleAngle = useSharedValue(0);

  useEffect(() => {
    idleAngle.value = withRepeat(
      withTiming(TWO_PI, { duration: IDLE_CIRCLE_DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  return useAnimatedStyle(() => {
    'worklet';
    const angle = idleAngle.value;
    return {
      transform: [
        { translateX: IDLE_CIRCLE_RADIUS * Math.cos(angle) },
        { translateY: IDLE_CIRCLE_RADIUS * Math.sin(angle) },
        { scale: 1 + IDLE_SCALE_DELTA * Math.sin(angle) },
      ],
    };
  });
}
