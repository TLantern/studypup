import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, SUBTITLE_GRAY, OFF_WHITE, CARD_SHADOW, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont, scaleVertical, isSmallDevice } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';

const BULLETS = [
  { emoji: '🔒', text: 'Audio recordings are private by default' },
  { emoji: '🗑️', text: 'Delete any note, any time' },
  { emoji: '😊', text: 'Trusted by professionals' },
];

export default function PrivacyTrustScreen() {
  const insets = useSafeAreaInsets();
  const lockAnim = useRef<LottieView>(null);

  useEffect(() => {
    trackPageViewed('ob_pro_privacy');
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
          <Text style={styles.title}>Your privacy and security are our top priority.</Text>

          <LottieView
            ref={lockAnim}
            source={require('../lock animation.json')}
            autoPlay
            loop={false}
            style={styles.lockAnimation}
          />

          <View style={styles.bullets}>
            {BULLETS.map((b) => (
              <View key={b.text} style={styles.bulletRow}>
                <Text style={styles.bulletEmoji}>{b.emoji}</Text>
                <Text style={styles.bulletText}>{b.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={() => { hapticContinue(); router.push('/get-ready'); }}>
            <Text style={styles.continueBtnText}>Got it</Text>
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
    width: '96%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: scaleVertical(isSmallDevice ? 16 : 40),
  },
  lockAnimation: {
    width: scaleSize(isSmallDevice ? 90 : 120),
    height: scaleSize(isSmallDevice ? 90 : 120),
    alignSelf: 'center',
    marginBottom: scaleVertical(isSmallDevice ? 16 : 24),
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(26),
    fontWeight: '700',
    color: DEEP_BLACK,
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: scaleFont(34),
    marginBottom: scaleSize(16),
  },
  bullets: {
    gap: scaleVertical(isSmallDevice ? 12 : 20),
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(16),
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(12),
    paddingVertical: scaleVertical(isSmallDevice ? 12 : 16),
    paddingHorizontal: scaleSize(18),
    ...CARD_SHADOW,
  },
  bulletEmoji: {
    fontSize: scaleFont(22),
  },
  bulletText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    fontWeight: '500',
    color: DEEP_BLACK,
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
  },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
});
