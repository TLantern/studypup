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

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Paywall</Text>
        <View style={styles.buttons}>
          <Pressable style={styles.continueBtn} onPress={() => router.push('/notifications')}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 32, color: '#000', textAlign: 'center' },
  buttons: { paddingTop: 100 },
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
