import { ProgressBar } from '@/components/ProgressBar';
import { trackEvent } from '@/lib/mixpanel';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GPAChart from '@/components/GPAChart';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const SUBTITLE = 'With consistent use, StudyPup helps you improve your grades over time.';
const TYPEWRITER_SPEED = 28;

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const ANIMATION_DURATION = 2800; // matches chart: 100ms delay + 2600ms

export default function PlanPreviewScreen() {
  const insets = useSafeAreaInsets();
  const [displayed, setDisplayed] = useState('');
  const [ready, setReady] = useState(false);
  const indexRef = useRef(0);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackEvent('plan-preview');
      tracked.current = true;
    }
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(SUBTITLE.slice(0, indexRef.current));
      if (indexRef.current >= SUBTITLE.length) clearInterval(interval);
    }, TYPEWRITER_SPEED);
    const timer = setTimeout(() => setReady(true), ANIMATION_DURATION);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, []);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.progressWrap}><ProgressBar progress={70} /></View>
        <Text style={styles.heading}>First Step Complete</Text>
        <Text style={styles.subtitle}>{displayed}</Text>
        <View style={styles.chartWrap}>
          <GPAChart />
        </View>
        <View style={styles.buttons}>
          <Pressable style={[styles.btn, !ready && styles.btnDisabled]} onPress={() => ready && router.push('/plan-usage' as never)} disabled={!ready}>
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  progressWrap: { width: '100%', marginBottom: scaleSize(16) },
  heading: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: scaleFont(28), color: '#000', textAlign: 'center', marginBottom: scaleSize(10) },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333', textAlign: 'center', marginBottom: scaleSize(20), lineHeight: scaleFont(26), minHeight: scaleSize(52) },
  chartWrap: { flex: 1, justifyContent: 'center' },
  buttons: { marginTop: 'auto', paddingTop: scaleSize(6) },
  btn: {
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    paddingHorizontal: RESPONSIVE.buttonPaddingHorizontal,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
  btnDisabled: { backgroundColor: '#C0C0C0', borderColor: '#A0A0A0' },
});
