import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackEvent } from '@/lib/mixpanel';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { scaleFont, scaleSize } from '@/lib/responsive';

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
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
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
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  title: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: scaleFont(34), color: '#000', textAlign: 'center', marginBottom: 16 },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 17,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  starsRow: { alignItems: 'center', marginVertical: 24 },
  stars: { fontSize: 44, color: '#FFD700', letterSpacing: 4 },
  bottomSection: { marginTop: 'auto', paddingTop: 6, position: 'relative', alignItems: 'center' },
  puppy: { position: 'absolute', bottom: 51, width: 140, height: 120, zIndex: 1, marginBottom: -34 },
  continueBtn: {
    marginBottom: -34,
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
});
