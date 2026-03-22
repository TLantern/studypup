import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useContext, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackEvent } from '@/lib/mixpanel';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function RatingScreen() {
  const insets = useSafeAreaInsets();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackEvent('rating');
      tracked.current = true;
    }
  }, []);

  useEffect(() => {
    const show = async () => {
      if (await StoreReview.hasAction()) await StoreReview.requestReview();
    };
    const t = setTimeout(show, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Love Studypup?</Text>
        <Text style={styles.subtitle}>
          Your feedback helps us improve and helps other students discover a smarter way to study. If you're enjoying the app, a quick 5‑star review means the world to us!
        </Text>
        <View style={styles.starsRow}>
          <Text style={styles.stars}>★★★★★</Text>
        </View>
        <View style={styles.bottomSection}>
          <Image source={require('../assets/buttonpup.png')} style={styles.puppy} contentFit="contain" />
          <Pressable style={styles.continueBtn} onPress={() => router.replace(superwallAvailable ? '/paywall' : '/signup')}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: RESPONSIVE.horizontalPadding, justifyContent: 'space-between' },
  title: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: scaleFont(34), color: '#000', textAlign: 'center', marginBottom: scaleSize(16) },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(17),
    color: '#333',
    textAlign: 'center',
    lineHeight: scaleFont(24),
    paddingHorizontal: scaleSize(8),
  },
  starsRow: { alignItems: 'center', marginVertical: scaleSize(24) },
  stars: { fontSize: scaleFont(44), color: '#FFD700', letterSpacing: scaleSize(4) },
  bottomSection: { marginTop: 'auto', paddingTop: scaleSize(6), position: 'relative', alignItems: 'center' },
  puppy: { position: 'absolute', bottom: scaleSize(51), width: scaleSize(140), height: scaleSize(120), zIndex: 1, marginBottom: scaleSize(-34) },
  continueBtn: {
    marginBottom: scaleSize(-34),
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    paddingHorizontal: RESPONSIVE.buttonPaddingHorizontal,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
});
