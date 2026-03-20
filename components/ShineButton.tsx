import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, type LayoutChangeEvent, type ViewStyle } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: ViewStyle;
  disabled?: boolean;
  children?: React.ReactNode;
};

export default function ShineButton({
  label,
  onPress,
  backgroundColor = '#FD8A8A',
  textColor = '#fff',
  borderColor,
  borderWidth = 0,
  style,
  disabled,
  children,
}: Props) {
  const shine = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [width, setWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  useEffect(() => {
    if (width === 0) return;
    const start = -width * 0.6;
    const end = width * 1.4;

    const run = () => {
      shine.setValue(start);
      animRef.current = Animated.sequence([
        Animated.delay(3500),
        Animated.timing(shine, { toValue: end, duration: 900, useNativeDriver: true }),
      ]);
      animRef.current.start(({ finished }) => { if (finished) run(); });
    };
    run();
    return () => animRef.current?.stop();
  }, [width]);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled}>
      <Animated.View
        onLayout={onLayout}
        style={[
          styles.btn,
          { backgroundColor, borderColor: borderColor ?? 'transparent', borderWidth },
          style,
          { transform: [{ scale }] },
        ]}
      >
        {children ?? <Text style={[styles.label, { color: textColor }]}>{label}</Text>}

        <Animated.View
          style={[styles.shineWrap, { transform: [{ translateX: shine }, { rotate: '20deg' }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shine}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 10,
  },
  label: { fontSize: 18, fontFamily: 'Fredoka_400Regular' },
  shineWrap: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    left: 0,
    width: '45%',
  },
  shine: { flex: 1 },
});
