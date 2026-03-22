import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { trackEvent } from '@/lib/mixpanel';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';

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
  const tracked = useRef(false);
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={20} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>What's your learning level?</Text>
        <Text style={styles.subtitle}>Choose the one that fits you best</Text>

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
              if (!tracked.current) {
                trackEvent('grade-level');
                tracked.current = true;
              }
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
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  title: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: RESPONSIVE.titleMedium, color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  subtitle: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#333',
    textAlign: 'center',
    marginBottom: scaleSize(24),
    textDecorationColor: '#3b82f6',
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(16),
    marginBottom: scaleSize(10),
    borderWidth: 1,
    borderColor: '#ddd',
  },
  gradeBtnSelected: {
    borderColor: '#FD8A8A',
    borderWidth: 2,
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  gradeText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  gradeEmoji: { fontSize: RESPONSIVE.titleSmall },
  bottomSection: {
    marginTop: 'auto',
    paddingTop: scaleSize(6),
    position: 'relative',
    alignItems: 'center',
  },
  puppy: {
    position: 'absolute',
    bottom: scaleSize(51),
    width: scaleSize(140),
    height: scaleSize(120),
    zIndex: 1,
    marginBottom: scaleSize(-34),
  },
  continueBtn: {
    marginBottom: scaleSize(-34),
    backgroundColor: '#FD8A8A',
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    paddingHorizontal: RESPONSIVE.buttonPaddingHorizontal,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, color: '#fff' },
  continueBtnDisabled: { opacity: 0.6 },
});
