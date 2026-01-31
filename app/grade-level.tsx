import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const GRADES = [
  { id: 'elementary', label: 'Elementary', emoji: '🖍️' },
  { id: 'middleschool', label: 'Middle School', emoji: '🎒' },
  { id: 'highschool', label: 'Highschool', emoji: '📚' },
  { id: 'college', label: 'College', emoji: '🎓' },
  { id: 'lifelong', label: 'Lifelong Learner', emoji: '💡' },
];

export default function GradeLevelScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('highschool');
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>What grade level are you?</Text>
        <Text style={styles.subtitle}>I am in...</Text>

        {GRADES.map((g) => (
          <Pressable
            key={g.id}
            style={[styles.gradeBtn]}
            onPress={() => setSelected(g.id)}
          >
            <Text style={styles.gradeText}>{g.label}</Text>
            <Text style={styles.gradeEmoji}>{g.emoji}</Text>
          </Pressable>
        ))}

        <View style={styles.bottomSection}>
          <Image
            source={require('../assets/buttonpup.png')}
            style={styles.puppy}
            contentFit="contain"
          />
          <Pressable style={styles.continueBtn} onPress={() => router.push('/subjects')}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 28, color: '#000', textAlign: 'center', marginBottom: 4 },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
    textDecorationColor: '#3b82f6',
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  gradeText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
  gradeEmoji: { fontSize: 24 },
  bottomSection: {
    marginTop: 'auto',
    paddingTop: 16,
    position: 'relative',
    alignItems: 'center',
  },
  puppy: {
    position: 'absolute',
    bottom: 51,
    width: 140,
    height: 120,
    zIndex: 1,
  },
  continueBtn: {
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
