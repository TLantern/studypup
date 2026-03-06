import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '@/components/ProgressBar';
import { scaleSize, scaleFont, RESPONSIVE, SCREEN_WIDTH } from '@/lib/responsive';
import { applyNotifPrefs, getNotifPrefs, requestPermissions } from '@/lib/notifications';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const BELL_SIZE = SCREEN_WIDTH * 0.28;

export default function NotificationOptinScreen() {
  const insets = useSafeAreaInsets();

  async function allow() {
    const granted = await requestPermissions();
    if (granted) {
      const prefs = await getNotifPrefs();
      await applyNotifPrefs(prefs);
    }
    router.push('/current-gpa');
  }

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}>
            <ProgressBar progress={70} />
          </View>
        </View>

        <View style={styles.middle}>
          <View style={styles.bellWrap}>
            <Ionicons name="notifications" size={BELL_SIZE * 0.55} color="#FD8A8A" />
          </View>

          <Text style={styles.title}>Stay on track with reminders</Text>
          <Text style={styles.subtitle}>
            We'll send you a daily nudge so you never miss a study session and keep your streak alive.
          </Text>

          <View style={styles.pillRow}>
            {['📚 Daily reminder', '🔥 Streak alerts', '🧠 Review nudges'].map(p => (
              <View key={p} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.buttons}>
          <Pressable style={styles.allowBtn} onPress={allow}>
            <Text style={styles.allowBtnText}>Allow Notifications</Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={() => router.push('/current-gpa')}>
            <Text style={styles.skipBtnText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: RESPONSIVE.horizontalPadding,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellWrap: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: BELL_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleSize(32),
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: RESPONSIVE.titleSmall,
    color: '#000',
    textAlign: 'center',
    marginBottom: scaleSize(12),
  },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.body,
    color: 'rgba(0,0,0,0.65)',
    textAlign: 'center',
    lineHeight: scaleFont(24),
    marginBottom: scaleSize(28),
    paddingHorizontal: scaleSize(8),
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scaleSize(8),
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(6),
    paddingHorizontal: scaleSize(14),
  },
  pillText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#333',
  },
  buttons: {
    gap: scaleSize(12),
    marginBottom: scaleSize(-34),
  },
  allowBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  allowBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.button,
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: scaleSize(12),
  },
  skipBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(16),
    color: 'rgba(0,0,0,0.45)',
  },
});
