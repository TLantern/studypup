import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Animated, Pressable, StyleSheet, Text, View, TouchableWithoutFeedback, Keyboard, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-store';
import { checkUserRegistered, setUserRegistered } from '@/lib/user-profile';
import { getItem, setItem } from '@/lib/storage';
import { signInWithGoogle, signInWithApple, googleStatusCodes } from '@/lib/auth';
import * as StoreReview from 'expo-store-review';
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

function ShineButton({
  label,
  icon,
  onPress,
  disabled,
  delayMs = 0,
  buttonStyle,
  textStyle,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  delayMs?: number;
  buttonStyle?: object;
  textStyle?: object;
}) {
  const shineX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    const run = () => {
      shineX.setValue(-SCREEN_WIDTH * 0.6);
      Animated.timing(shineX, {
        toValue: SCREEN_WIDTH * 0.6,
        duration: 650,
        useNativeDriver: true,
      }).start();
    };
    const initial = setTimeout(run, delayMs);
    const interval = setInterval(run, 3200);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  return (
    <Pressable
      style={[styles.socialBtn, buttonStyle, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon}
      <Text style={[styles.socialBtnText, textStyle]}>{label}</Text>
      <Animated.View
        style={[styles.shineSweep, { transform: [{ translateX: shineX }] }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: SCREEN_WIDTH * 0.35, height: '100%' }}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function CreateAccountScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ then?: string; mode?: string }>();
  const { uid, user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccountModal, setNoAccountModal] = useState(false);

  useEffect(() => {
    trackPageViewed('create_account');
  }, []);

  useEffect(() => {
    getItem('review:shown').then(async (shown) => {
      if (!shown) {
        await setItem('review:shown', 'true');
        if (await StoreReview.hasAction()) StoreReview.requestReview();
      }
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    console.log('[create-account] uid set, mode:', params.mode, 'uid:', uid);

    if (params.mode === 'login') {
      console.log('[create-account] login mode — checking Firestore for registered flag');
      checkUserRegistered(uid).then((registered) => {
        console.log('[create-account] checkUserRegistered result:', registered);
        if (!registered) {
          console.log('[create-account] no account found — signing out, showing modal');
          signOut();
          setNoAccountModal(true);
        } else {
          console.log('[create-account] account verified — navigating to tabs');
          ttTrackRegistration();
          ttIdentify(uid, user?.email ?? '');
          router.replace('/(tabs)');
        }
      }).catch((e) => {
        console.error('[create-account] checkUserRegistered error:', e);
      });
      return;
    }

    console.log('[create-account] signup mode — stamping registered, navigating');
    setUserRegistered(uid).catch((e) => console.error('[create-account] setUserRegistered error:', e));
    ttTrackRegistration();
    ttIdentify(uid, user?.email ?? '');
    if (params.then === 'paywall') router.replace('/paywall');
    else router.replace('/(tabs)');
  }, [uid, params.then, params.mode]);

  const handleGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.code !== googleStatusCodes.SIGN_IN_CANCELLED) {
        setError(e?.message ?? 'Google sign-in failed. Please try again.');
      }
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
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e?.message ?? 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>
            {params.mode === 'login' ? 'Log in to your account' : 'Sign up to get started'}
          </Text>

          <View style={styles.centeredBlock}>
          <ShineButton
            label="Continue with Google"
            icon={<Image source={require('@/assets/icons/google.png')} style={styles.socialIcon} contentFit="contain" />}
            onPress={handleGoogle}
            disabled={busy}
            delayMs={400}
            buttonStyle={styles.googleBtn}
          />
          <ShineButton
            label="Continue with Apple"
            icon={<Image source={require('@/assets/icons/apple.png')} style={[styles.socialIcon, styles.socialIconWhite]} contentFit="contain" />}
            onPress={handleApple}
            disabled={busy}
            delayMs={1800}
            buttonStyle={styles.appleBtn}
            textStyle={{ color: '#fff' }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.phoneBtn}
            onPress={() => router.push({ pathname: '/phone-login', params: { then: params.then, mode: params.mode } })}
          >
            <Text style={styles.phoneBtnText}>Login with phone number</Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>
      </TouchableWithoutFeedback>

      <Modal visible={noAccountModal} transparent animationType="fade" onRequestClose={() => setNoAccountModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>No account found</Text>
            <Text style={styles.modalBody}>
              We couldn't find an account linked to that sign-in. Please go through sign-up first.
            </Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => { setNoAccountModal(false); router.replace('/'); }}
            >
              <Text style={styles.modalBtnText}>Back to Welcome</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: OFF_WHITE },
  container: { flex: 1, paddingHorizontal: SCREEN_WIDTH * 0.06, justifyContent: 'space-between' },
  centeredBlock: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(32), color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  subtitle: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333', textAlign: 'center', marginBottom: scaleSize(16) },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scaleSize(12),
    paddingVertical: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    marginBottom: scaleSize(12),
    minHeight: scaleSize(56),
    overflow: 'hidden',
    ...BUTTON_SHADOW,
  },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  appleBtn: { backgroundColor: '#000' },
  socialIcon: { width: scaleSize(22), height: scaleSize(22), marginRight: scaleSize(10) },
  socialIconWhite: { tintColor: '#fff' },
  socialBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(18), color: '#333' },
  shineSweep: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleSize(16), marginTop: scaleSize(4) },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ccc' },
  dividerText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#333', marginHorizontal: scaleSize(16) },
  phoneBtn: {
    alignItems: 'center',
    paddingVertical: scaleSize(14),
  },
  phoneBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(17),
    color: '#333',
    textDecorationLine: 'underline',
  },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(14), color: '#b91c1c', marginTop: scaleSize(8), textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: scaleSize(32) },
  modalCard: { backgroundColor: '#fff', borderRadius: scaleSize(20), padding: scaleSize(28), width: '100%', alignItems: 'center' },
  modalTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(22), color: '#000', marginBottom: scaleSize(12), textAlign: 'center' },
  modalBody: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#444', textAlign: 'center', marginBottom: scaleSize(24), lineHeight: scaleFont(22) },
  modalBtn: { backgroundColor: '#FD8A8A', borderRadius: scaleSize(12), paddingVertical: scaleSize(14), paddingHorizontal: scaleSize(32), ...BUTTON_SHADOW },
  modalBtnText: { fontFamily: 'FredokaOne_400Regular', fontSize: scaleFont(18), color: '#fff' },
});
