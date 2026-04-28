import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';
import { scaleSize, scaleFont, SCREEN_WIDTH } from '@/lib/responsive';
import { applyNotifPrefs, getNotifPrefs, requestPermissions } from '@/lib/notifications';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';
import { DEEP_BLACK, OFF_WHITE, ACCENT_BLUE, SUBTITLE_GRAY, SF_PRO, CARD_SHADOW, sharedStyles } from '@/lib/onboarding-theme';

const BELL_SIZE = SCREEN_WIDTH * 0.24;

export default function NotificationOptinScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    trackPageViewed('ob_student_reminders');
  }, []);

  async function allow() {
    hapticContinue();
    const granted = await requestPermissions();
    if (granted) {
      const prefs = await getNotifPrefs();
      await applyNotifPrefs(prefs);
    }
    router.push('/current-gpa');
  }

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(24), paddingBottom: insets.bottom + scaleSize(24) }]}>
        <View style={styles.progressRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '56%' }]} />
          </View>
        </View>

        <View style={styles.middle}>
          <View style={styles.bellWrap}>
            <Ionicons name="notifications" size={BELL_SIZE * 0.52} color={ACCENT_BLUE} />
          </View>

          <Text style={styles.title}>Stay on track with reminders</Text>
          <Text style={styles.subtitle}>
            We'll send you a daily nudge so you never miss a study session and keep your streak alive.
          </Text>

          <View style={styles.pillRow}>
            {['📚 Daily reminder', '🔥 Streak alerts', '🧠 Review nudges'].map((p) => (
              <View key={p} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={allow}>
            <Text style={styles.continueBtnText}>Allow Notifications</Text>
          </Pressable>
          <Pressable style={styles.skipWrap} onPress={() => { hapticContinue(); router.push('/current-gpa'); }}>
            <Text style={styles.skipText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: { ...sharedStyles.container, justifyContent: 'space-between' },
  progressTrack: sharedStyles.progressTrack,
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleSize(8),
  },
  bellWrap: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: BELL_SIZE / 2,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleSize(32),
  },
  title: { ...sharedStyles.title, textAlign: 'center' },
  subtitle: { ...sharedStyles.subtitle, textAlign: 'center', lineHeight: scaleFont(22) },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scaleSize(8),
    marginTop: scaleSize(8),
  },
  pill: {
    backgroundColor: OFF_WHITE,
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(6),
    paddingHorizontal: scaleSize(14),
  },
  pillText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(13),
    color: DEEP_BLACK,
    fontWeight: '500',
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleSize(16), gap: scaleSize(8) },
  progressTrack: { flex: 1, height: 10, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6 },
  backBtn: { padding: scaleSize(4) },
  footer: { gap: scaleSize(4) },
  continueBtn: sharedStyles.continueBtn,
  continueBtnText: sharedStyles.continueBtnText,
  skipWrap: { alignItems: 'center', paddingVertical: scaleSize(14) },
  skipText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: SUBTITLE_GRAY,
  },
});
