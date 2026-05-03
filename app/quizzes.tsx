import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useHoverFloatStyle } from '@/lib/useHoverFloat';
import { RESPONSIVE, scaleSize, SCREEN_HEIGHT } from '@/lib/responsive';
import { OnboardingView } from '@/components/OnboardingView';
import { ACCENT_BLUE, ACCENT_BLUE_PRESSED, ACCENT_BLUE_TINT, OFF_WHITE, DEEP_BLACK, SUBTITLE_GRAY, SF_PRO } from '@/lib/onboarding-theme';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function QuizzesScreen() {
  const insets = useSafeAreaInsets();
  const hoverStyle = useHoverFloatStyle();
  return (
    <OnboardingView>
      <LinearGradient colors={[ACCENT_BLUE_TINT, OFF_WHITE]} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../assets/images/progresspill4.png')} style={styles.progress} contentFit="contain" />
        <Text style={styles.heading}>Test your knowledge{'\n'}with Custom Quizzes</Text>
        <Text style={styles.subtext}>AI builds tailored quizzes from your notes.</Text>
        <Animated.View style={[styles.heroWrap, hoverStyle]}>
          <Image source={require('../assets/images/quizzes.png')} style={styles.hero} contentFit="contain" />
        </Animated.View>
        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={() => router.push('/students-improve' as never)}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Continue</Text>
          </Pressable>
        </View>
      </View>
      </LinearGradient>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  progress: { width: 120, height: 16, alignSelf: 'center', marginBottom: 24 },
  heading: { fontFamily: SF_PRO, fontSize: RESPONSIVE.titleLarge, color: DEEP_BLACK, textAlign: 'center', marginBottom: scaleSize(8) },
  subtext: { fontFamily: SF_PRO, fontSize: RESPONSIVE.subtitle, color: SUBTITLE_GRAY, textAlign: 'center', marginBottom: 24 },
  heroWrap: { flex: 1, width: '100%', maxHeight: SCREEN_HEIGHT * 0.54, alignSelf: 'center', marginBottom: 24 },
  hero: { width: '100%', height: '100%' },
  buttons: { marginTop: 'auto', paddingTop: 6, marginBottom: -24 },
  btn: {
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: ACCENT_BLUE,
    borderColor: ACCENT_BLUE_PRESSED,
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: SF_PRO, fontSize: 24 },
  btnPrimaryText: { color: '#fff' },
});
