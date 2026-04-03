import { MeshGradientView } from 'expo-mesh-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

const COLORS = [
  '#FFD6DC', '#FFBBC8', '#E8B8E8',
  '#C4E9E9', '#AADDDD', '#B8E0F5',
  '#FD8A8A', '#FFAA88', '#FFDBB8',
];

type Point = [number, number];

const BASE: Point[] = [
  [0, 0],     [0.5, 0],     [1, 0],
  [0, 0.5],   [0.5, 0.5],   [1, 0.5],
  [0, 1],     [0.5, 1],     [1, 1],
];

const DRIFT = 0.055;
const PERIOD = 8000;
const TWO_PI = Math.PI * 2;

export function MeshGradientBackground() {
  const [points, setPoints] = useState<Point[]>(BASE);
  const t0 = useRef(Date.now());
  const raf = useRef<ReturnType<typeof requestAnimationFrame>>(0);

  useEffect(() => {
    const tick = () => {
      const t = (Date.now() - t0.current) / PERIOD;
      setPoints([
        BASE[0],
        [0.5 + DRIFT * Math.sin(TWO_PI * t),              0],
        BASE[2],
        [0,  0.5 + DRIFT * 0.7 * Math.sin(TWO_PI * t + 1)],
        [0.5 + DRIFT * 0.5 * Math.cos(TWO_PI * t),
         0.5 + DRIFT * 0.5 * Math.sin(TWO_PI * t * 0.7)],
        [1,  0.5 + DRIFT * 0.7 * Math.sin(TWO_PI * t + 2)],
        BASE[6],
        [0.5 + DRIFT * Math.sin(TWO_PI * t + 3),          1],
        BASE[8],
      ]);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <MeshGradientView
      style={StyleSheet.absoluteFill}
      columns={3}
      rows={3}
      colors={COLORS}
      points={points}
      smoothsColors
      ignoresSafeArea
    />
  );
}
