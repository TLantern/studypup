import { ProgressBar } from '@/components/ProgressBar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { getOnboarding } from '@/lib/onboarding-storage';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const BULLETS = [
  'Track your GPA rising week by week',
  'Lock in a study system you actually stick to',
  'Learn faster with your personal AI tutor',
];

const TYPEWRITER_SPEED = 30;
const BULLET_DELAY_BASE = 600;

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

function BulletItem({ text, delay }: { text: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400 }));
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[styles.bullet, style]}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </Animated.View>
  );
}

const STUDENT_COUNTS = ['5,000', '7,500', '10,000', '12,000', '15,000', '18,000', '20,000'];
const randomCount = () => STUDENT_COUNTS[Math.floor(Math.random() * STUDENT_COUNTS.length)];

export default function StudentsStatsScreen() {
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState('your subject');
  const [displayed, setDisplayed] = useState('');
  const fullText = useRef('');
  const indexRef = useRef(0);
  const studentCount = useRef(randomCount());
  const [bulletsVisible, setBulletsVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const subtitleOpacity = useSharedValue(0);
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  useEffect(() => {
    getOnboarding().then(({ subjects }) => {
      const s = subjects?.[0] ?? 'your subject';
      setSubject(s);
      fullText.current = `We helped over ${studentCount.current} ⭐ students taking ${s} increase their GPA with StudyPup`;
      subtitleOpacity.value = withTiming(1, { duration: 300 });
      const interval = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(fullText.current.slice(0, indexRef.current));
        if (indexRef.current >= fullText.current.length) {
          clearInterval(interval);
          setTimeout(() => {
            setBulletsVisible(true);
            setTimeout(() => setReady(true), BULLET_DELAY_BASE * BULLETS.length + 400);
          }, 300);
        }
      }, TYPEWRITER_SPEED);
      return () => clearInterval(interval);
    });
  }, []);

  const totalTypewriterMs = (fullText.current.length || 60) * TYPEWRITER_SPEED + 300;

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.progressWrap}><ProgressBar progress={40} /></View>
        <Text style={styles.title}>We got you!</Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>{displayed}</Animated.Text>

        {bulletsVisible && (
          <View style={styles.bulletsWrap}>
            {BULLETS.map((b, i) => (
              <BulletItem key={b} text={b} delay={i * BULLET_DELAY_BASE} />
            ))}
          </View>
        )}

        <View style={styles.buttons}>
          <Pressable style={[styles.btn, !ready && styles.btnDisabled]} onPress={() => ready && router.push('/current-gpa' as never)} disabled={!ready}>
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  progressWrap: { width: '100%', marginBottom: scaleSize(16) },
  title: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(40),
    color: '#000',
    textAlign: 'center',
    marginBottom: scaleSize(16),
  },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(20),
    color: '#333',
    textAlign: 'center',
    marginBottom: scaleSize(36),
    lineHeight: scaleFont(28),
    minHeight: scaleSize(84),
  },
  bulletsWrap: { gap: scaleSize(20) },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(14),
  },
  checkCircle: {
    width: scaleSize(36),
    height: scaleSize(36),
    borderRadius: scaleSize(18),
    backgroundColor: '#5DC872',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: { color: '#fff', fontSize: scaleFont(18), fontWeight: '700' },
  bulletText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(20),
    color: '#000',
    fontWeight: '600',
    flex: 1,
  },
  buttons: { marginTop: 'auto', paddingTop: scaleSize(6) },
  btn: {
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    paddingHorizontal: RESPONSIVE.buttonPaddingHorizontal,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
  btnDisabled: { backgroundColor: '#C0C0C0', borderColor: '#A0A0A0' },
});
