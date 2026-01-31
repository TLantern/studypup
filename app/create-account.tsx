import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Create an Account</Text>
        <Text style={styles.subtitle}>Sign up with your phone number</Text>

        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+1</Text>
          </View>
          <TextInput style={styles.phoneInput} placeholder="Phone number" placeholderTextColor="#999" keyboardType="phone-pad" />
        </View>
        <Pressable style={styles.continueBtn} onPress={() => router.push('/where-study')}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Other options</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.optionsContainer}>
          <Pressable style={styles.optionBtn}>
            <Image source={require('../assets/icons/email.png')} style={styles.optionIcon} />
            <Text style={styles.optionText}>Sign up with Email</Text>
          </Pressable>
          <Pressable style={styles.optionBtn}>
            <Image source={require('../assets/icons/apple.png')} style={styles.optionIcon} />
            <Text style={styles.optionText}>Sign up with Apple</Text>
          </Pressable>
          <Pressable style={styles.optionBtn}>
            <Image source={require('../assets/icons/google.png')} style={styles.optionIcon} />
            <Text style={styles.optionText}>Sign up with Google</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 32, color: '#000', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 32 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
    overflow: 'hidden',
  },
  countryCode: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  countryCodeText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
  phoneInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, fontFamily: 'Fredoka_400Regular', fontSize: 16 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 20, color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ccc' },
  dividerText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333', marginHorizontal: 16 },
  optionsContainer: {
    backgroundColor: '#FD8A8A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  optionIcon: { width: 24, height: 24, marginRight: 12 },
  optionText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
});
