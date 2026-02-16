import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useHoverFloatStyle } from '@/lib/useHoverFloat';
import { scaleFont, scaleSize, SCREEN_WIDTH, SCREEN_HEIGHT, RESPONSIVE } from '@/lib/responsive';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const hoverStyle = useHoverFloatStyle();
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../assets/images/progresspill1.png')} style={styles.progress} contentFit="contain" />
        <Text style={styles.heading}>Record Your Lectures</Text>
        <Text style={styles.subtext}>Capture audio from classes and turn them into study notes.</Text>
        <Animated.View style={[styles.heroWrap, hoverStyle]}>
          <Image source={require('../assets/images/recordlecture.png')} style={styles.hero} contentFit="contain" />
        </Animated.View>
        <View style={styles.buttons}>
        <Pressable style={styles.btn} onPress={() => router.push('/flashcards')}>
          <Text style={[styles.btnText, styles.btnPrimaryText]}>Continue</Text>
        </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.containerPadding },
  progress: { width: scaleSize(120), height: scaleSize(16), alignSelf: 'center', marginBottom: scaleSize(24) },
  heading: { fontFamily: 'FredokaOne_400Regular', fontSize: RESPONSIVE.titleLarge, color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.subtitle, color: '#333', textAlign: 'center', marginBottom: scaleSize(-64) },
  heroWrap: { width: '100%', height: SCREEN_HEIGHT * 0.7, alignSelf: 'center' },
  hero: { width: '100%', height: '100%'},
  buttons: { marginTop: scaleSize(-10)},
  btn: {
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    paddingHorizontal: RESPONSIVE.buttonPaddingHorizontal,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
    minHeight: RESPONSIVE.buttonMinHeight,
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button },
  btnPrimaryText: { color: '#fff' },
});
