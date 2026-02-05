import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { confirmPhoneOtp, sendMagicLink, signInWithApple, signInWithGoogle, startPhoneSignIn } from '@/lib/auth';
import * as Linking from 'expo-linking';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const { uid } = useAuth();
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const firebaseConfig = useMemo(
    () => ({
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    }),
    []
  );

  useEffect(() => {
    if (uid) router.replace('/(tabs)');
  }, [uid]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (!pendingEmail) return;
      setError(null);
      setBusy(true);
      try {
        const { completeMagicLink } = await import('@/lib/auth');
        await completeMagicLink(url, pendingEmail);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to sign in with magic link.');
      } finally {
        setBusy(false);
      }
    });
    return () => sub.remove();
  }, [pendingEmail]);

  const normalizePhoneE164 = (raw: string) => {
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.length === 10) return `+1${digits}`;
    return digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+${digits}`;
  };

  const canSend = phone.trim().length >= 10 && !busy && cooldown === 0;
  const canVerify = code.trim().length >= 6 && !busy;

  const handleSend = async () => {
    if (!canSend) return;
    if (resendCount >= 5) {
      setError('Too many attempts. Please wait a bit and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await startPhoneSignIn(normalizePhoneE164(phone), recaptchaRef);
      setStage('otp');
      setCooldown(45);
      setResendCount((c) => c + 1);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      setError(
        code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait and try again.'
          : code === 'auth/invalid-phone-number'
            ? 'Invalid phone number.'
            : e?.message ?? 'Failed to send code.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify) return;
    setBusy(true);
    setError(null);
    try {
      await confirmPhoneOtp(code.trim());
    } catch (e: any) {
      const c = e?.code as string | undefined;
      setError(
        c === 'auth/invalid-verification-code'
          ? 'Invalid code.'
          : c === 'auth/session-expired'
            ? 'Code expired. Request a new one.'
            : e?.message ?? 'Invalid code.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithApple();
    } catch (e: any) {
      setError(e?.message ?? 'Apple sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setPendingEmail(email.trim());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send magic link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Create an Account</Text>
        <Text style={styles.subtitle}>Sign up with your phone number</Text>

        <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={firebaseConfig as any} />

        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+1</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="Phone number"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={!busy}
          />
        </View>
        {stage === 'otp' ? (
          <View style={styles.otpRow}>
            <TextInput
              style={styles.otpInput}
              placeholder="6-digit code"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              editable={!busy}
              maxLength={6}
            />
          </View>
        ) : null}

        <Pressable
          style={[styles.continueBtn, (stage === 'phone' ? !canSend : !canVerify) && styles.continueBtnDisabled]}
          onPress={stage === 'phone' ? handleSend : handleVerify}
          disabled={stage === 'phone' ? !canSend : !canVerify}
        >
          <Text style={styles.continueBtnText}>
            {stage === 'phone'
              ? cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Send code'
              : 'Verify code'}
          </Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Other options</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.optionsContainer}>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.emailInput}
              placeholder="Email for magic link"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            <Pressable style={[styles.emailBtn, !email.trim() && styles.continueBtnDisabled]} onPress={handleEmail} disabled={!email.trim() || busy}>
              <Text style={styles.emailBtnText}>{pendingEmail ? 'Sent' : 'Send'}</Text>
            </Pressable>
          </View>
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.optionBtn} onPress={handleApple} disabled={busy}>
              <Image source={require('../assets/icons/apple.png')} style={styles.optionIcon} />
              <Text style={styles.optionText}>Continue with Apple</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.optionBtn} onPress={handleGoogle} disabled={busy}>
            <Image source={require('../assets/icons/google.png')} style={styles.optionIcon} />
            <Text style={styles.optionText}>Continue with Google</Text>
          </Pressable>
        </View>

        {pendingEmail ? (
          <Text style={styles.magicHint}>Check your email and tap the link to finish signing in.</Text>
        ) : null}
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
  otpRow: { marginBottom: 16 },
  otpInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    ...BUTTON_SHADOW,
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 20, color: '#fff' },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#b91c1c', marginTop: -16, marginBottom: 16, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ccc' },
  dividerText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#333', marginHorizontal: 16 },
  optionsContainer: {
    backgroundColor: '#FD8A8A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  emailRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emailInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
  },
  emailBtn: { backgroundColor: '#333', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
  emailBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#fff' },
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
  magicHint: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#333', marginTop: 12, textAlign: 'center' },
});
