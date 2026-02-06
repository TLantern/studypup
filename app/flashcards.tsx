import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useHoverFloatStyle } from '@/lib/useHoverFloat';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const hoverStyle = useHoverFloatStyle();
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../assets/images/progresspill2.png')} style={styles.progress} contentFit="contain" />
        <Text style={styles.heading}>Turn Notes into Flashcards in Seconds!</Text>
        <Text style={styles.subtext}>AI turns your notes into personalized flashcards.</Text>
        <Animated.View style={[styles.heroWrap, hoverStyle]}>
          <Image source={require('../assets/images/flashcards.png')} style={styles.hero} contentFit="contain" />
        </Animated.View>
        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={() => router.push('/instantanswers')}>
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
  subtext: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 24 },
  heroWrap: { flex: 1, width: '100%', maxHeight: 360, alignSelf: 'center', marginBottom: 24 },
  hero: { width: '100%', height: '100%' },
  buttons: { marginTop: 'auto', paddingTop: 6, marginBottom: -24 },
  btn: {
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24 },
  btnPrimaryText: { color: '#fff' },
});
