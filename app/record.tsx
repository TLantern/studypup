import { RESPONSIVE, scaleSize, SCREEN_HEIGHT } from '@/lib/responsive';
import { useHoverFloatStyle } from '@/lib/useHoverFloat';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trackPageViewed } from '@/lib/analytics';

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
  useEffect(() => {
    trackPageViewed('onboarding_record');
  }, []);
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
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.subtitle, color: '#333', textAlign: 'center', marginBottom: 24 },
  heroWrap: { flex: 1, width: '100%', maxHeight: SCREEN_HEIGHT * 0.54, alignSelf: 'center', marginBottom: 24 },
  hero: { width: '100%', height: '100%' },
  buttons: { marginTop: 'auto', paddingTop: 6, marginBottom: -24 },
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
