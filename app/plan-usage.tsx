import { ProgressBar } from '@/components/ProgressBar';
import { useAuth } from '@/lib/auth-store';
import { updateOnboarding } from '@/lib/onboarding-storage';
import { RESPONSIVE, scaleSize, SCREEN_WIDTH } from '@/lib/responsive';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { setItem as storageSetItem } from '@/lib/storage';
import { ensureUserDoc } from '@/lib/user-profile';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingView } from '@/components/OnboardingView';

const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';
const IS_IPAD = SCREEN_WIDTH >= 768;

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
  { id: 'answers', label: 'Getting Instant Answers', icon: 'flash' as const },
  { id: 'other', label: 'Other', icon: 'help-circle' as const },
];

export default function PlanUsageScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const superwallAvailable = useContext(SuperwallAvailableContext);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    trackPageViewed('onboarding_plan_usage');
  }, []);

  return (
    <OnboardingView>
      <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.headerRow}>
          <View style={styles.progressWrap}><ProgressBar progress={80} /></View>
        </View>
        <Text style={[styles.title, { marginTop: 24 }]}>How do you plan on using Studypup?</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.id}
              style={[styles.optionBtn, selected.includes(o.id) && styles.optionBtnSelected]}
              onPress={() => setSelected(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
            >
              <Text style={styles.optionText}>{o.label}</Text>
              <Ionicons name={o.icon} size={RESPONSIVE.iconSmall} color={selected.includes(o.id) ? '#7c3aed' : '#666'} />
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
            router.push('/creating-plan');
          }}
          disabled={selected.length === 0}
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
  container: { flex: 1, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: scaleSize(12) },
  progressWrap: { flex: 1 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: IS_IPAD ? 34 : 28, color: '#000', textAlign: 'center', marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: scaleSize(16) },
  optionBtn: {
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
  optionBtnSelected: { borderColor: '#7c3aed', borderWidth: 2 },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.body, color: '#000' },
  bottomSection: { marginTop: 'auto', paddingTop: 6, marginBottom: -34, position: 'relative', alignItems: 'center', gap: 12 },
  puppy: { position: 'absolute', bottom: IS_IPAD ? 42 : 52, width: 128, height: 110, zIndex: 1 },
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
  skipText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleSize(16), color: '#555', textAlign: 'center', textDecorationLine: 'underline' },
});
