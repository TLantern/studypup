import { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { welcomeIconRef } from '@/lib/welcomeIconRef';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Size of icon as it appears in the native splash (imageWidth:300, icon is 420/1024 of that canvas)
const OVERLAY_ICON_SIZE = Math.round(300 * (420 / 1024));

interface Props {
  fontsReady: boolean;
  onDone: () => void;
}

export function SplashTransition({ fontsReady, onDone }: Props) {
  const bgOpacity = useSharedValue(1);
  const iconOpacity = useSharedValue(1);
  const iconTx = useSharedValue(0);
  const iconTy = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const triggered = useRef(false);

  function startAnimation(layout: ReturnType<typeof welcomeIconRef.get>) {
    const DURATION = 560;
    const easing = Easing.inOut(Easing.cubic);

    bgOpacity.value = withTiming(0, { duration: DURATION, easing: Easing.out(Easing.cubic) }, () => {
      runOnJS(onDone)();
    });

    if (layout) {
      // Transform order [translateX, translateY, scale] keeps translation in screen-space
      // so tx/ty are independent of scale and the center traces a straight line.
      const cx = SCREEN_WIDTH / 2;
      const cy = SCREEN_HEIGHT / 2;
      iconTx.value = withTiming((layout.x + layout.width / 2) - cx, { duration: DURATION, easing });
      iconTy.value = withTiming((layout.y + layout.height / 2) - cy, { duration: DURATION, easing });
      iconScale.value = withTiming(layout.width / OVERLAY_ICON_SIZE, { duration: DURATION, easing });
    } else {
      runOnJS(onDone)();
    }
  }

  useEffect(() => {
    if (!fontsReady || triggered.current) return;

    let attempts = 0;
    function tryStart() {
      const layout = welcomeIconRef.get();
      if (layout || attempts >= 6) {
        triggered.current = true;
        startAnimation(layout);
      } else {
        attempts++;
        setTimeout(tryStart, 50);
      }
    }
    tryStart();
  }, [fontsReady]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [
      { translateX: iconTx.value },
      { translateY: iconTy.value },
      { scale: iconScale.value },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]} />
      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <Image
          source={require('../assets/images/notario-icon.png')}
          style={styles.icon}
          contentFit="cover"
        />
      </Animated.View>
    </Animated.View>
  );
}

const RADIUS = OVERLAY_ICON_SIZE * 0.26;

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9999,
  },
  bg: {
    backgroundColor: '#000000',
  },
  iconContainer: {
    position: 'absolute',
    left: (SCREEN_WIDTH - OVERLAY_ICON_SIZE) / 2,
    top: (SCREEN_HEIGHT - OVERLAY_ICON_SIZE) / 2,
    width: OVERLAY_ICON_SIZE,
    height: OVERLAY_ICON_SIZE,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  icon: {
    width: OVERLAY_ICON_SIZE,
    height: OVERLAY_ICON_SIZE,
  },
});
