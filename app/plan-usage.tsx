import { ProgressBar } from '@/components/ProgressBar';
import { useAuth } from '@/lib/auth-store';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { RESPONSIVE, scaleSize } from '@/lib/responsive';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { setItem as storageSetItem } from '@/lib/storage';
import { ensureUserDoc } from '@/lib/user-profile';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const OPTIONS = [
  { id: 'recording', label: 'Recording Lectures', icon: 'mic' as const },
  { id: 'notes', label: 'Generating Notes', icon: 'document-text' as const },
  { id: 'flashcards', label: 'Flashcards', icon: 'layers' as const },
  { id: 'quizzes', label: 'Quizzes', icon: 'locate' as const },
  { id: 'answers', label: 'AI Tutor', icon: 'school' as const },
  { id: 'other', label: 'Other', icon: 'help-circle' as const },
];

export default function PlanUsageScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={80} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>What brings you to Studypup?</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.optionBtn, selected.includes(o.id) && styles.optionBtnSelected]}
              onPress={() => setSelected(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
            >
              <Text style={styles.optionText}>{o.label}</Text>
              <Ionicons name={o.icon} size={RESPONSIVE.iconSmall} color={selected.includes(o.id) ? '#FD8A8A' : '#666'} />
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.bottomSection}>
          <Image source={require('../assets/buttonpup.png')} style={styles.puppy} contentFit="contain" />
          <Pressable onPress={() => router.replace(superwallAvailable ? '/paywall' : '/create-account')}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable
          style={[styles.continueBtn, selected.length === 0 && styles.continueBtnDisabled]}
          onPress={async () => {
            if (selected.length === 0) return;
            await updateOnboarding({ plan_usage: selected });
            await storageSetItem(ONBOARDING_COMPLETE_KEY, 'true');
            if (user) await ensureUserDoc(user).catch((e) => console.error('Failed to save onboarding to Firebase:', e));
            router.push('/rating');
          }}
          disabled={selected.length === 0}
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
  container: { flex: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  title: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: RESPONSIVE.titleSmall, color: '#000', textAlign: 'center', marginBottom: scaleSize(24) },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: scaleSize(16) },
  optionBtn: {
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
  optionBtnSelected: {
    borderColor: '#FD8A8A',
    borderWidth: 2,
    shadowColor: '#FD8A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  bottomSection: { marginTop: 'auto', paddingTop: scaleSize(6), position: 'relative', alignItems: 'center' },
  puppy: { position: 'absolute', bottom: scaleSize(51), width: scaleSize(140), height: scaleSize(120), zIndex: 1, marginBottom: scaleSize(-34) },
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
  skipText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#555', textAlign: 'center', textDecorationLine: 'underline', marginBottom: scaleSize(12) },
});
