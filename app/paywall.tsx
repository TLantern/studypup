import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setItem as storageSetItem } from '@/lib/storage';
import { ProgressBar } from '@/components/ProgressBar';
import { SuperwallAvailableContext, usePlacementHook } from '@/lib/superwall';

const PLACEMENT = 'StudyPup_paywall';
const ONBOARDING_KEY = 'onboardingComplete';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

function PaywallWithSuperwall() {
  const usePlacement = usePlacementHook!;
  const navigateToMain = useCallback(() => router.replace('/create-account'), []);

  const { registerPlacement } = usePlacement({
    onDismiss: navigateToMain,
    onSkip: navigateToMain,
    onError: (err: unknown) => {
      console.error('Superwall paywall error:', err);
      navigateToMain();
    },
  });

  const handlePress = async () => {
    try {
      await storageSetItem(ONBOARDING_KEY, 'true');
      await registerPlacement({ placement: PLACEMENT, feature: navigateToMain });
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      navigateToMain();
    }
  };

  return <PaywallUI onContinue={handlePress} />;
}

function PaywallWithoutSuperwall() {
  const handlePress = async () => {
    try {
      await storageSetItem(ONBOARDING_KEY, 'true');
      router.replace('/create-account');
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      router.replace('/create-account');
    }
  };

  return <PaywallUI onContinue={handlePress} />;
}

export default function PaywallScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  return superwallAvailable ? <PaywallWithSuperwall /> : <PaywallWithoutSuperwall />;
}

function PaywallUI({ onContinue }: { onContinue: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleContinue = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onContinue();
    } finally {
      setLoading(false);
    }
  }, [loading, onContinue]);

  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View>
          <ProgressBar progress={100} />
          <Text style={[styles.title, { marginTop: 24 }]}>Paywall</Text>
        </View>
        <View style={styles.buttons}>
          <Pressable style={styles.continueBtn} onPress={handleContinue} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Continue</Text>}
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 32, color: '#000', textAlign: 'center' },
  buttons: { marginTop: 'auto', paddingTop: 6 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
});
