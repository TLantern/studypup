import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { OnboardingView } from '@/components/OnboardingView';
import { getOnboarding } from '@/lib/onboarding-storage';
import { RESPONSIVE, scaleFont, scaleSize, scaleVertical, isSmallDevice } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

const DEEP_BLACK = '#0D0D0F';
const ACCENT_BLUE = '#7FA8FF';
const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const WORK_TYPE_LABELS: Record<string, string> = {
  business_owner: 'Business',
  creative_media: 'Creative & Media',
  education: 'Education',
  finance: 'Finance',
  healthcare: 'Healthcare',
  legal: 'Legal',
  manager_executive: 'Management',
  sales_marketing: 'Sales & Marketing',
  skilled_trades: 'Skilled Trades',
  tech_it: 'Tech & IT',
  other: 'their field',
};

const STUDENT_COUNTS = ['5,000', '7,500', '10,000', '12,000', '15,000', '18,000', '20,000'];
const randomCount = () => STUDENT_COUNTS[Math.floor(Math.random() * STUDENT_COUNTS.length)];

const TYPEWRITER_SPEED = 20;
const BULLET_DELAY_BASE = 600;

const BULLETS = [
  'Never miss a detail again',
  'Stop writing, start focusing',
  'Your meetings captured, automatically',
];

function BulletItem({ text, delay }: { text: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.bullet, style]}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </Animated.View>
  );
}

export default function StudentsStatsScreen() {
  const insets = useSafeAreaInsets();
  const [displayed, setDisplayed] = useState('');
  const fullText = useRef('');
  const indexRef = useRef(0);
  const studentCount = useRef(randomCount());
  const [bulletsVisible, setBulletsVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const subtitleOpacity = useSharedValue(0);
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  useEffect(() => {
    trackPageViewed('ob_pro_social_proof');
    getOnboarding().then(({ subjects, work_type, user_tag }) => {
      let context = 'your field';
      if (user_tag === 'working-class' && work_type) {
        context = WORK_TYPE_LABELS[work_type] ?? 'their field';
      } else if (subjects?.[0]) {
        context = subjects[0];
      }
      fullText.current = `We've helped over ${studentCount.current} ${context} professionals stay present in every meeting with Notario`;
      subtitleOpacity.value = withTiming(1, { duration: 300 });

      const interval = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(fullText.current.slice(0, indexRef.current));
        if (indexRef.current >= fullText.current.length) {
          clearInterval(interval);
          setTimeout(() => {
            setBulletsVisible(true);
            setTimeout(() => setReady(true), 400);
          }, 300);
        }
      }, TYPEWRITER_SPEED);

      return () => clearInterval(interval);
    });
  }, []);

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleVertical(isSmallDevice ? 16 : 40), paddingBottom: insets.bottom + scaleVertical(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <Text style={styles.title}>You're in good company</Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>{displayed}</Animated.Text>

        {bulletsVisible && (
          <View style={styles.bulletsWrap}>
            {BULLETS.map((b, i) => (
              <BulletItem key={b} text={b} delay={i * BULLET_DELAY_BASE} />
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueBtn, !ready && styles.continueBtnDisabled]}
            onPress={() => { if (ready) { hapticContinue(); router.push('/meetings-per-week'); } }}
            disabled={!ready}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
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
    paddingHorizontal: RESPONSIVE.horizontalPadding,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleVertical(isSmallDevice ? 20 : 36),
    gap: scaleSize(8),
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    width: '42%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: DEEP_BLACK,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: scaleSize(20),
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    color: '#333',
    textAlign: 'center',
    lineHeight: scaleFont(26),
    marginBottom: scaleVertical(isSmallDevice ? 20 : 36),
    minHeight: scaleVertical(isSmallDevice ? 60 : 80),
  },
  bulletsWrap: {
    gap: scaleVertical(isSmallDevice ? 12 : 20),
  },
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
  checkMark: {
    color: '#fff',
    fontSize: scaleFont(18),
    fontWeight: '700',
  },
  bulletText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    color: DEEP_BLACK,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: scaleSize(6),
  },
  backBtn: {
    padding: scaleSize(4),
  },
  continueBtn: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(18),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  continueBtnDisabled: {
    backgroundColor: '#C0C0C0',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
