import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont, scaleVertical, isSmallDevice } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

function PulseMic() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.25, { duration: 1400 }), -1, true);
    opacity.value = withRepeat(withSequence(withTiming(0.1, { duration: 1400 }), withTiming(0.3, { duration: 1400 })), -1, false);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.micWrap}>
      <Animated.View style={[styles.micRingOuter, ringStyle]} />
      <View style={styles.micRingInner} />
      <View style={styles.micCircle}>
        <Ionicons name="mic" size={scaleSize(28)} color="#fff" />
      </View>
    </View>
  );
}

export default function GetReadyScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_pro_get_ready');
  }, []);

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

        <View style={styles.body}>
          <PulseMic />

          <Text style={styles.title}>
            Get ready to join{'\n'}
            <Text style={styles.titleAccent}>10,000+ </Text>
            professionals{'\n'}
            currently using{' '}
            <Text style={styles.titleAccent}>Notario</Text>
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/pro-offer'); }}>
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
    width: '100%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleVertical(isSmallDevice ? 24 : 36),
    paddingBottom: scaleVertical(isSmallDevice ? 20 : 40),
  },
  micWrap: {
    width: scaleSize(isSmallDevice ? 90 : 120),
    height: scaleSize(isSmallDevice ? 90 : 120),
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRingOuter: {
    position: 'absolute',
    width: scaleSize(isSmallDevice ? 90 : 120),
    height: scaleSize(isSmallDevice ? 90 : 120),
    borderRadius: scaleSize(isSmallDevice ? 45 : 60),
    backgroundColor: ACCENT_BLUE,
  },
  micRingInner: {
    position: 'absolute',
    width: scaleSize(isSmallDevice ? 66 : 88),
    height: scaleSize(isSmallDevice ? 66 : 88),
    borderRadius: scaleSize(isSmallDevice ? 33 : 44),
    backgroundColor: `${ACCENT_BLUE}30`,
  },
  micCircle: {
    width: scaleSize(isSmallDevice ? 48 : 64),
    height: scaleSize(isSmallDevice ? 48 : 64),
    borderRadius: scaleSize(isSmallDevice ? 24 : 32),
    backgroundColor: ACCENT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(28),
    fontWeight: '700',
    color: DEEP_BLACK,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: scaleFont(38),
  },
  titleAccent: {
    color: ACCENT_BLUE,
  },
  footer: {
    marginTop: 'auto',
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
