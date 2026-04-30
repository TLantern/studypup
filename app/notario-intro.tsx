import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont, scaleVertical, isSmallDevice } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

const ITEMS = [
  { emoji: '✍️', label: 'Writing by hand' },
  { emoji: '💻', label: 'Typing during meetings' },
  { emoji: '🎙️', label: 'Voice memos' },
];

const ITEM_DELAY = 400;
const STRIKE_OFFSET = 250;
const COPY_DELAY = ITEMS.length * ITEM_DELAY + STRIKE_OFFSET + 300;

function StrikeItem({ emoji, label, index }: { emoji: string; label: string; index: number }) {
  const opacity = useSharedValue(0);
  const strikeWidth = useSharedValue(0);

  useEffect(() => {
    const enterDelay = index * ITEM_DELAY;
    opacity.value = withDelay(enterDelay, withTiming(1, { duration: 300 }));
    strikeWidth.value = withDelay(enterDelay + STRIKE_OFFSET, withTiming(100, { duration: 350 }));
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const strikeStyle = useAnimatedStyle(() => ({
    width: `${strikeWidth.value}%` as any,
  }));

  return (
    <Animated.View style={[styles.strikeRow, containerStyle]}>
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.strikeLabelWrap}>
        <Text style={styles.strikeLabel}>{label}</Text>
        <Animated.View style={[styles.strikeLine, strikeStyle]} />
      </View>
    </Animated.View>
  );
}

export default function NotarioIntroScreen() {
  const insets = useSafeAreaInsets();
  const copyOpacity = useSharedValue(0);
  const copyTranslate = useSharedValue(16);

  useEffect(() => {
    trackPageViewed('ob_pro_notario_intro');
    copyOpacity.value = withDelay(COPY_DELAY, withTiming(1, { duration: 400 }));
    copyTranslate.value = withDelay(COPY_DELAY, withTiming(0, { duration: 400 }));
  }, []);

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    transform: [{ translateY: copyTranslate.value }],
  }));

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleVertical(24), paddingBottom: insets.bottom + scaleVertical(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <View style={styles.strikeSection}>
          {ITEMS.map((item, i) => (
            <StrikeItem key={item.label} emoji={item.emoji} label={item.label} index={i} />
          ))}
        </View>

        <View style={styles.divider} />

        <Animated.View style={copyStyle}>
          <Text style={styles.copyText}>
            Here's how{' '}
            <Text style={styles.copyAccent}>Notario</Text>
            {' '}is designed to help
          </Text>
        </Animated.View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/feature-record'); }}>
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
    marginBottom: scaleVertical(isSmallDevice ? 20 : 36),
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
    width: '36%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  strikeSection: {
    gap: scaleVertical(isSmallDevice ? 14 : 20),
    marginBottom: scaleVertical(isSmallDevice ? 20 : 32),
  },
  strikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(12),
  },
  emojiWrap: {
    opacity: 0.3,
  },
  emoji: {
    fontSize: scaleFont(22),
  },
  strikeLabelWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  strikeLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(17),
    color: 'rgba(0,0,0,0.25)',
    fontWeight: '500',
  },
  strikeLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 1,
    top: '50%',
    left: 0,
  },
  divider: {
    width: scaleSize(48),
    height: 3,
    backgroundColor: ACCENT_BLUE,
    borderRadius: 2,
    marginBottom: scaleVertical(isSmallDevice ? 16 : 28),
  },
  copyText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(isSmallDevice ? 30 : 38),
    fontWeight: '800',
    color: DEEP_BLACK,
    letterSpacing: -1,
    lineHeight: scaleFont(isSmallDevice ? 38 : 46),
  },
  copyAccent: {
    color: ACCENT_BLUE,
  },
  footer: {
    marginTop: 'auto',
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
