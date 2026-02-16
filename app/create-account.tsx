import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { getItem, setItem } from '@/lib/storage';
import { confirmPhoneOtp, sendMagicLink, startPhoneSignIn } from '@/lib/auth';
import * as Linking from 'expo-linking';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const PENDING_EMAIL_KEY = 'auth:pendingEmail';

// Get screen dimensions for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive scaling functions
const scaleFont = (size: number) => {
  const baseWidth = 375; // iPhone X base width
  const ratio = SCREEN_WIDTH / baseWidth;
  return Math.round(size * ratio);
};

const scaleSize = (size: number) => {
  const baseWidth = 375;
  const ratio = SCREEN_WIDTH / baseWidth;
  return Math.round(size * ratio);
};

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ then?: string }>();
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
    if (!uid) return;
    if (params.then === 'paywall') router.replace('/paywall');
    else router.replace('/(tabs)');
  }, [uid, params.then]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const storedEmail = pendingEmail ?? (await getItem(PENDING_EMAIL_KEY));
      if (!storedEmail || busy) return;
      setError(null);
      setBusy(true);
      try {
        const { completeMagicLink } = await import('@/lib/auth');
        await completeMagicLink(url, storedEmail);
        setPendingEmail(null);
        await setItem(PENDING_EMAIL_KEY, '');
      } catch (e: any) {
        setError(e?.message ?? 'Failed to sign in with magic link.');
      } finally {
        setBusy(false);
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url) void handleUrl(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    return () => sub.remove();
  }, [pendingEmail, busy]);

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
      console.error('Phone auth error:', e);
      setError(
        code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait and try again.'
          : code === 'auth/invalid-phone-number'
            ? 'Invalid phone number.'
            : code === 'auth/captcha-check-failed'
            ? 'Verification failed. Please try again.'
            : Platform.OS === 'ios'
            ? 'On simulator, use test phone: +1 650-555-3434 (code: 123456) [Configure in Firebase Console]'
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

  const handleEmail = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = email.trim();
      await sendMagicLink(trimmed);
      setPendingEmail(trimmed);
      await setItem(PENDING_EMAIL_KEY, trimmed);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send magic link.');
    } finally {
      setBusy(false);
    }
  };

  // Google OAuth commented out
  // const handleGoogle = async () => { ... };

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Create an Account</Text>
        <Text style={styles.subtitle}>Sign up with your phone number</Text>

        <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={firebaseConfig as any} attemptInvisibleVerification />

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
          <>
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
            <Text style={styles.otpHint}>Code sent. It may take 1–2 minutes to arrive.</Text>
            <Pressable
              style={[styles.resendBtn, (cooldown > 0 || busy) && styles.resendBtnDisabled]}
              onPress={handleSend}
              disabled={cooldown > 0 || busy}
            >
              <Text style={styles.resendBtnText}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
          </>
        ) : null}

        <Pressable
          style={[styles.continueBtn, (stage === 'phone' ? !canSend : !canVerify) && styles.continueBtnDisabled]}
          onPress={stage === 'phone' ? handleSend : handleVerify}
          disabled={stage === 'phone' ? !canSend : !canVerify}
        >
          <Text style={styles.continueBtnText}>
            {stage === 'phone' ? 'Send code' : 'Verify code'}
          </Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {false && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Other options</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.optionsContainer}>
              <View style={styles.emailRow}>
                <TextInput
                  style={styles.emailInput}
                  placeholder="Email Address"
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
            </View>
            {pendingEmail ? (
              <Text style={styles.magicHint}>Check your email and tap the link to finish signing in.</Text>
            ) : null}
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SCREEN_WIDTH * 0.06 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(32), color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333', textAlign: 'center', marginBottom: scaleSize(32) },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: scaleSize(16),
    overflow: 'hidden',
  },
  countryCode: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(16),
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  countryCodeText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#000' },
  phoneInput: { flex: 1, paddingHorizontal: scaleSize(16), paddingVertical: scaleSize(16), fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16) },
  otpRow: { marginBottom: scaleSize(16) },
  otpInput: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(12),
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(16),
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(16),
  },
  otpHint: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  resendBtn: {
    alignItems: 'center',
    marginBottom: scaleSize(16),
    paddingVertical: scaleSize(8),
  },
  resendBtnDisabled: { opacity: 0.5 },
  resendBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(16),
    color: '#333',
    textDecorationLine: 'underline',
  },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    alignItems: 'center',
    marginBottom: scaleSize(32),
    minHeight: scaleSize(56),
    ...BUTTON_SHADOW,
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(20), color: '#fff' },
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
