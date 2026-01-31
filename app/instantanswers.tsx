import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function InstantAnswersScreen() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../assets/images/progresspill3.png')} style={styles.progress} contentFit="contain" />
        <Text style={styles.heading}>Snap a Photo, Get Instant AI Answers!</Text>
        <Text style={styles.subtext}>Take a photo of any question, get in-depth explanations.</Text>
        <Image source={require('../assets/images/instantanswers.png')} style={styles.hero} contentFit="contain" />
        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={() => router.push('/quizzes')}>
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
  hero: { flex: 1, width: '100%', maxHeight: 360, alignSelf: 'center', marginBottom: 24 },
  buttons: { paddingTop: 100 },
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
