import * as StoreReview from 'expo-store-review';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const STARS = ['⭐', '⭐', '⭐', '⭐', '⭐'];

export default function RatingScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      }
      router.push('/plan-ready' as never);
    })();
  }, []);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.center}>
          <Text style={styles.heading}>Enjoying StudyPup?</Text>
          <Text style={styles.subtext}>Let us know how we're doing — it means the world to us 🐾</Text>
          <View style={styles.starsRow}>
            {STARS.map((s, i) => <Text key={i} style={styles.star}>{s}</Text>)}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  center: { flex: 1, justifyContent: 'center' },
  heading: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(34), color: '#000', textAlign: 'center', marginBottom: scaleSize(12) },
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333', textAlign: 'center', marginBottom: scaleSize(32) },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: scaleSize(8) },
  star: { fontSize: scaleFont(40) },
});
