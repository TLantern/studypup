import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

const BAR_HEIGHTS = [14, 22, 36, 28, 48, 38, 56, 44, 32, 50, 40, 28, 46, 54, 36, 44, 30, 48, 38, 22];

function WaveBar({ maxHeight, delay }: { maxHeight: number; delay: number }) {
  const h = useSharedValue(maxHeight * 0.25);

  useEffect(() => {
    h.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(maxHeight, { duration: 380 + delay % 120 }),
          withTiming(maxHeight * 0.2, { duration: 380 + delay % 120 }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, style]} />;
}

function PulseRing() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.35, { duration: 1200 }), -1, true);
    opacity.value = withRepeat(withSequence(withTiming(0.15, { duration: 1200 }), withTiming(0.4, { duration: 1200 })), -1, false);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseRing, style]} />;
}

export default function FeatureRecordScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_pro_feature_record');
  }, []);

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <Text style={styles.title}>
          Just hit{' '}
          <Text style={styles.titleAccent}>record</Text>
        </Text>
        <Text style={styles.subtitle}>Notario handles everything from there.</Text>

        <View style={styles.mockup}>
          <View style={styles.micWrap}>
            <PulseRing />
            <View style={styles.micCircle}>
              <Ionicons name="mic" size={scaleSize(40)} color="#fff" />
            </View>
          </View>

          <Text style={styles.recordingLabel}>Recording Notario...</Text>
          <Text style={styles.timer}>8 min, 42 sec</Text>

          <View style={styles.waveform}>
            {BAR_HEIGHTS.map((h, i) => (
              <WaveBar key={i} maxHeight={scaleSize(h)} delay={i * 60} />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/feature-notes'); }}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: sharedStyles.container,
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(32),
    gap: scaleSize(8),
  },
  backBtn: { padding: scaleSize(4) },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  progressFill: {
    height: '100%',
    width: '30%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(34),
    fontWeight: '800',
    color: DEEP_BLACK,
    letterSpacing: -0.8,
    marginBottom: scaleSize(10),
  },
  titleAccent: {
    color: ACCENT_BLUE,
  },
  subtitle: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    color: SUBTITLE_GRAY,
    marginBottom: scaleSize(48),
  },
  mockup: {
    alignItems: 'center',
    flex: 1,
  },
  micWrap: {
    width: scaleSize(120),
    height: scaleSize(120),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleSize(28),
  },
  pulseRing: {
    position: 'absolute',
    width: scaleSize(120),
    height: scaleSize(120),
    borderRadius: scaleSize(60),
    backgroundColor: ACCENT_BLUE,
  },
  micCircle: {
    width: scaleSize(88),
    height: scaleSize(88),
    borderRadius: scaleSize(44),
    backgroundColor: ACCENT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  recordingLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
    marginBottom: scaleSize(4),
  },
  timer: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    fontWeight: '600',
    color: DEEP_BLACK,
    marginBottom: scaleSize(28),
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(4),
    height: scaleSize(60),
  },
  bar: {
    width: scaleSize(4),
    backgroundColor: ACCENT_BLUE,
    borderRadius: scaleSize(3),
    opacity: 0.75,
  },
  footer: {
    marginTop: 'auto',
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
