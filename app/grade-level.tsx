import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { scaleFont, scaleSize, RESPONSIVE, SCREEN_WIDTH } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { OnboardingView } from '@/components/OnboardingView';

const IS_IPAD = SCREEN_WIDTH >= 768;

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
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    trackPageViewed('onboarding_grade_level');
  }, []);
  return (
    <OnboardingView>
      <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={40} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>What grade level are you?</Text>
        <Text style={styles.subtitle}>I am in...</Text>

        {GRADES.map((g) => (
          <Pressable
            key={g.id}
            style={[styles.gradeBtn, selected === g.id && styles.gradeBtnSelected]}
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
          <Pressable
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
            onPress={async () => {
              if (!selected) return;
              await updateOnboarding({ grade_level: selected });
              router.push('/subjects');
            }}
            disabled={!selected}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
      </LinearGradient>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: IS_IPAD ? 34 : 28, color: '#000', textAlign: 'center', marginBottom: 24 },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: IS_IPAD ? 22 : 18,
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
    borderRadius: scaleSize(IS_IPAD ? 10 : 12),
    paddingVertical: scaleSize(IS_IPAD ? 12 : 14),
    paddingHorizontal: scaleSize(IS_IPAD ? 14 : 16),
    marginBottom: scaleSize(IS_IPAD ? 8 : 10),
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  gradeBtnSelected: { borderColor: '#7c3aed', borderWidth: 2 },
  gradeText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  gradeEmoji: { fontSize: RESPONSIVE.titleSmall },
  bottomSection: {
    marginTop: 'auto',
    paddingTop: 6,
    position: 'relative',
    alignItems: 'center',
    gap: 12,
  },
  puppy: {
    position: 'absolute',
    bottom: IS_IPAD ? 42 : 52,
    width: 128,
    height: 110,
    zIndex: 1,
  },
  continueBtn: {
    marginTop: IS_IPAD ? 52 : 68,
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: IS_IPAD ? 14 : 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: IS_IPAD ? 22 : 24, color: '#fff' },
  continueBtnDisabled: { opacity: 0.6 },
});
