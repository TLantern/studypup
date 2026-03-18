import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useHoverFloatStyle } from '@/lib/useHoverFloat';
import { ProgressBar } from '@/components/ProgressBar';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function DemoPageScreen() {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const hoverStyle = useHoverFloatStyle();

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.progressWrap}><ProgressBar progress={10} /></View>
        <Text style={styles.heading}>Upload. Learn. Improve.</Text>
        <Animated.View style={[styles.heroWrap, hoverStyle]}>
          <LottieView
            ref={lottieRef}
            source={require('../Astronaut_Dog.json')}
            style={styles.lottie}
            autoPlay
            loop
          />
        </Animated.View>
        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={() => router.push('/grade-level' as never)}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const LOTTIE_SIZE = scaleSize(300);

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  progressWrap: { width: '100%', marginBottom: scaleSize(16) },
  heading: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(32), color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  heroWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lottie: { width: LOTTIE_SIZE, height: LOTTIE_SIZE },
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
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button },
  btnPrimaryText: { color: '#fff' },
});
