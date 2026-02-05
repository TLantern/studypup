import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useHoverFloatStyle } from '@/lib/useHoverFloat';

const AnimatedImage = Animated.createAnimatedComponent(Image);

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
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../assets/images/progresspill4.png')} style={styles.progress} contentFit="contain" />
        <Text style={styles.heading}>Test your knowledge with{'\n'}Custom Quizzes</Text>
        <Text style={styles.subtext}>AI builds tailored quizzes from your notes.</Text>
        <AnimatedImage source={require('../assets/images/quizzes.png')} style={[styles.hero, hoverStyle]} contentFit="contain" />
        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={() => router.push('/where-study')}>
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  progress: { width: 120, height: 16, alignSelf: 'center', marginBottom: 24 },
  heading: { fontFamily: 'FredokaOne_400Regular', fontSize: 32, color: '#000', textAlign: 'center', marginBottom: 8 },
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#333', textAlign: 'center', marginBottom: -160 },
  hero: { width: '100%', height: 720, alignSelf: 'center'},
  buttons: { paddingTop: 100 },
  btn: {
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
    marginTop: -180,
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24 },
  btnPrimaryText: { color: '#fff' },
});
