import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useSuperwall } from 'expo-superwall';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PLACEMENT_ONBOARDING_COMPLETE, PLACEMENT_VALUE_SCREEN } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { RESPONSIVE, scaleSize } from '@/lib/responsive';
import { setItem } from '@/lib/storage';

const markReviewShown = () => setItem('review:shown', 'true');

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const preloadPaywalls = useSuperwall((s) => s.preloadPaywalls);

  useEffect(() => {
    trackPageViewed('onboarding_review');
  }, []);

  useEffect(() => {
    const show = async () => {
      if (await StoreReview.hasAction()) await StoreReview.requestReview();
    };
    const t = setTimeout(show, 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    preloadPaywalls([PLACEMENT_VALUE_SCREEN, PLACEMENT_ONBOARDING_COMPLETE]).catch(() => {});
  }, [preloadPaywalls]);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Enjoying Studypup?</Text>
        <Text style={styles.subtitle}>
          Your feedback helps us improve and helps other students discover a smarter way to study. If you have a moment, leaving a review means a lot to us!
        </Text>
        <View style={styles.starsRow}>
          <Text style={styles.stars}>★★★★★</Text>
        </View>
        <View style={styles.bottomSection}>
          <Pressable onPress={() => { markReviewShown(); router.replace('/(tabs)'); }}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable style={styles.continueBtn} onPress={() => { markReviewShown(); router.replace('/(tabs)'); }}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding, justifyContent: 'space-between' },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: RESPONSIVE.titleSmall, color: '#000', textAlign: 'center', marginBottom: scaleSize(16) },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: RESPONSIVE.body,
    color: '#333',
    textAlign: 'center',
    lineHeight: scaleSize(24),
    paddingHorizontal: scaleSize(8),
  },
  starsRow: { alignItems: 'center', marginVertical: scaleSize(24) },
  stars: { fontSize: scaleSize(44), color: '#FFD700', letterSpacing: scaleSize(4) },
  bottomSection: { marginTop: 'auto', paddingTop: scaleSize(6), alignItems: 'center', gap: scaleSize(12) },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: scaleSize(18),
    paddingHorizontal: scaleSize(32),
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
  skipText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleSize(16), color: '#555', textAlign: 'center', textDecorationLine: 'underline' },
});
