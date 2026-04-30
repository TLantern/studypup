import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View, TouchableWithoutFeedback, Keyboard, Modal, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, getStoredPhoneNumber } from '@/lib/auth-store';
import { checkUserRegistered } from '@/lib/user-profile';
import { confirmPhoneOtp, startPhoneSignIn } from '@/lib/auth';
import { scaleFont, scaleSize, SCREEN_WIDTH } from '@/lib/responsive';
import { trackPageViewed } from '@/lib/analytics';
import { ttTrackRegistration, ttIdentify } from '@/lib/tiktok-analytics';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const OFF_WHITE = '#F7F7F5';
const ACCENT_BLUE = '#7FA8FF';

const COUNTRIES = [
  { label: '🇺🇸 United States', dial: '+1' },
  { label: '🇬🇧 United Kingdom', dial: '+44' },
  { label: '🇨🇦 Canada', dial: '+1' },
  { label: '🇦🇺 Australia', dial: '+61' },
  { label: '🇮🇳 India', dial: '+91' },
  { label: '🇵🇭 Philippines', dial: '+63' },
  { label: '🇳🇬 Nigeria', dial: '+234' },
  { label: '🇿🇦 South Africa', dial: '+27' },
  { label: '🇲🇽 Mexico', dial: '+52' },
  { label: '🇧🇷 Brazil', dial: '+55' },
  { label: '🇩🇪 Germany', dial: '+49' },
  { label: '🇫🇷 France', dial: '+33' },
  { label: '🇮🇹 Italy', dial: '+39' },
  { label: '🇪🇸 Spain', dial: '+34' },
  { label: '🇯🇵 Japan', dial: '+81' },
  { label: '🇰🇷 South Korea', dial: '+82' },
  { label: '🇸🇬 Singapore', dial: '+65' },
  { label: '🇦🇪 UAE', dial: '+971' },
  { label: '🇰🇪 Kenya', dial: '+254' },
  { label: '🇬🇭 Ghana', dial: '+233' },
  { label: '🇳🇿 New Zealand', dial: '+64' },
  { label: '🇵🇰 Pakistan', dial: '+92' },
  { label: '🇧🇩 Bangladesh', dial: '+880' },
  { label: '🇮🇩 Indonesia', dial: '+62' },
];

export default function PhoneLoginScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ then?: string; mode?: string }>();
  const { uid, user, signOut } = useAuth();
  const [noAccountModal, setNoAccountModal] = useState(false);
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [phoneLoadedFromStorage, setPhoneLoadedFromStorage] = useState(false);

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
    trackPageViewed('phone_login');
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadStoredPhone = async () => {
      try {
        const storedPhone = await getStoredPhoneNumber();
        if (mounted && storedPhone && !phone) {
          const match = COUNTRIES.find(c => storedPhone.startsWith(c.dial));
          if (match) {
            setCountryCode(match.dial);
            setPhone(storedPhone.slice(match.dial.length));
          } else {
            setPhone(storedPhone.replace(/^\+/, ''));
          }
          setPhoneLoadedFromStorage(true);
        }
      } catch {}
    };
    loadStoredPhone();
    return () => { mounted = false; };
  }, [phone]);

  useEffect(() => {
    if (!uid) return;
    console.log('[phone-login] uid set, mode:', params.mode, 'uid:', uid);

    if (params.mode === 'login') {
      console.log('[phone-login] login mode — checking Firestore for registered flag');
      checkUserRegistered(uid).then((registered) => {
        console.log('[phone-login] checkUserRegistered result:', registered);
        if (!registered) {
          console.log('[phone-login] no account found — signing out, showing modal');
          signOut();
          setNoAccountModal(true);
        } else {
          console.log('[phone-login] account verified — navigating to tabs');
          ttTrackRegistration();
          ttIdentify(uid, user?.email ?? '', user?.phoneNumber ?? '');
          router.replace('/(tabs)');
        }
      }).catch((e) => {
        console.error('[phone-login] checkUserRegistered error:', e);
      });
      return;
    }

    console.log('[phone-login] signup mode — navigating');
    ttTrackRegistration();
    ttIdentify(uid, user?.email ?? '', user?.phoneNumber ?? '');
    if (params.then === 'paywall') router.replace('/paywall');
    else router.replace('/(tabs)');
  }, [uid, params.then, params.mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const normalizePhoneE164 = (raw: string) => `${countryCode}${raw.replace(/\D/g, '')}`;
  const canSend = phone.replace(/\D/g, '').length >= 6 && !busy && cooldown === 0;
  const canVerify = code.trim().length >= 6 && !busy;

  const handleSend = async () => {
    if (!canSend) return;
    if (resendCount >= 5) { setError('Too many attempts. Please wait a bit and try again.'); return; }
    setBusy(true);
    setError(null);
    try {
      await startPhoneSignIn(normalizePhoneE164(phone), recaptchaRef);
      setStage('otp');
      setCooldown(45);
      setResendCount(c => c + 1);
    } catch (e: any) {
      const c = e?.code as string | undefined;
      setError(
        c === 'auth/too-many-requests' ? 'Too many requests. Please wait and try again.'
        : c === 'auth/invalid-phone-number' ? 'Invalid phone number.'
        : c === 'auth/captcha-check-failed' ? 'Verification failed. Please try again.'
        : Platform.OS === 'ios' ? 'On simulator, use test phone: +1 650-555-3434 (code: 123456)'
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
        c === 'auth/invalid-verification-code' ? 'Invalid code.'
        : c === 'auth/session-expired' ? 'Code expired. Request a new one.'
        : e?.message ?? 'Invalid code.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>
            {phoneLoadedFromStorage ? 'Welcome back! Verify your phone number' : 'Log in with your phone number'}
          </Text>

          <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={firebaseConfig as any} attemptInvisibleVerification />

          <Modal visible={showCountryPicker} animationType="slide" transparent onRequestClose={() => setShowCountryPicker(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setShowCountryPicker(false)}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Select Country Code</Text>
                <FlatList
                  data={COUNTRIES}
                  keyExtractor={(item, i) => `${item.dial}-${i}`}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.countryItem, item.dial === countryCode && styles.countryItemActive]}
                      onPress={() => { setCountryCode(item.dial); setShowCountryPicker(false); }}
                    >
                      <Text style={styles.countryItemText}>{item.label}</Text>
                      <Text style={styles.countryItemDial}>{item.dial}</Text>
                    </Pressable>
                  )}
                />
              </View>
            </Pressable>
          </Modal>

          <View style={styles.phoneRow}>
            <Pressable style={styles.countryCode} onPress={() => setShowCountryPicker(true)}>
              <Text style={styles.countryCodeText}>{countryCode} ▾</Text>
            </Pressable>
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

          {stage === 'otp' && (
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
          )}

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
        </View>
      </TouchableWithoutFeedback>

      <Modal visible={noAccountModal} transparent animationType="fade" onRequestClose={() => setNoAccountModal(false)}>
        <View style={styles.noAccountOverlay}>
          <View style={styles.noAccountCard}>
            <Text style={styles.noAccountTitle}>No account found</Text>
            <Text style={styles.noAccountBody}>
              We couldn't find an account linked to that phone number. Please go through sign-up first.
            </Text>
            <Pressable
              style={styles.noAccountBtn}
              onPress={() => { setNoAccountModal(false); router.replace('/'); }}
            >
              <Text style={styles.noAccountBtnText}>Back to Welcome</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: OFF_WHITE },
  container: { flex: 1, paddingHorizontal: SCREEN_WIDTH * 0.06 },
  backBtn: { marginBottom: scaleSize(16) },
  backBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(17), color: '#333' },
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
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(16),
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    minWidth: scaleSize(68),
    alignItems: 'center',
  },
  countryCodeText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(15), color: '#000' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSize(20),
    borderTopRightRadius: scaleSize(20),
    maxHeight: '70%',
    paddingBottom: scaleSize(32),
  },
  modalTitle: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: scaleFont(20),
    textAlign: 'center',
    paddingVertical: scaleSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  countryItemActive: { backgroundColor: '#f0f8ff' },
  countryItemText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#000' },
  countryItemDial: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(15), color: '#555' },
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
  otpHint: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(13), color: '#666', textAlign: 'center', marginBottom: scaleSize(8) },
  resendBtn: { alignItems: 'center', marginBottom: scaleSize(16), paddingVertical: scaleSize(8) },
  resendBtnDisabled: { opacity: 0.5 },
  resendBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#333', textDecorationLine: 'underline' },
  continueBtn: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    alignItems: 'center',
    marginBottom: scaleSize(16),
    minHeight: scaleSize(56),
    ...BUTTON_SHADOW,
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(20), color: '#fff' },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(14), color: '#b91c1c', marginTop: scaleSize(4), textAlign: 'center' },
  noAccountOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: scaleSize(32) },
  noAccountCard: { backgroundColor: '#fff', borderRadius: scaleSize(20), padding: scaleSize(28), width: '100%', alignItems: 'center' },
  noAccountTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(22), color: '#000', marginBottom: scaleSize(12), textAlign: 'center' },
  noAccountBody: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#444', textAlign: 'center', marginBottom: scaleSize(24), lineHeight: scaleFont(22) },
  noAccountBtn: { backgroundColor: ACCENT_BLUE, borderRadius: scaleSize(12), paddingVertical: scaleSize(14), paddingHorizontal: scaleSize(32), ...BUTTON_SHADOW },
  noAccountBtnText: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(18), color: '#fff' },
});
