import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';
import { scaleFont, scaleSize, SCREEN_WIDTH } from '@/lib/responsive';
import ShineButton from '@/components/ShineButton';

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 4,
};

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ then?: string }>();
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApple = async () => {
    setLoading('apple');
    setError(null);
    try {
      await signInWithApple();
    } catch (e: any) {
      const code = e?.code ?? e?.nativeEvent?.code;
      if (code !== 'ERR_REQUEST_CANCELED' && code !== 1000) setError(e?.message ?? 'Apple sign-in failed.');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      if (e?.message !== 'Google sign-in cancelled.') setError(e?.message ?? 'Google sign-in failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + scaleSize(20), paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.title}>Let's save your{'\n'}Progress</Text>

        <View style={styles.centerBlock}>
        <View style={styles.buttons}>
          {Platform.OS === 'ios' && (
            <ShineButton
              label=""
              onPress={handleApple}
              backgroundColor="#000"
              textColor="#fff"
              style={[styles.btnBase, SHADOW]}
              disabled={!!loading}
            >
              <Image source={require('../assets/icons/apple.png')} style={styles.icon} contentFit="contain" tintColor="#fff" />
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
              {loading === 'apple' && <ActivityIndicator color="#fff" />}
            </ShineButton>
          )}

          <ShineButton
            label=""
            onPress={handleGoogle}
            backgroundColor="#fff"
            textColor="#222"
            borderColor="#ddd"
            borderWidth={1}
            style={[styles.btnBase, SHADOW]}
            disabled={!!loading}
          >
            <Image source={require('../assets/icons/google.png')} style={styles.icon} contentFit="contain" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
            {loading === 'google' && <ActivityIndicator color="#333" />}
          </ShineButton>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={styles.phoneLink}
          onPress={() => router.push(params.then ? { pathname: '/create-account', params: { then: params.then } } : '/create-account')}
        >
          <Text style={styles.phoneLinkText}>Login with phone number</Text>
        </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SCREEN_WIDTH * 0.06 },
  title: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: scaleFont(36), color: '#000', textAlign: 'center', marginBottom: scaleSize(8) },
  centerBlock: { flex: 1, justifyContent: 'center' },
  buttons: { width: '100%', gap: scaleSize(24) },
  btnBase: { paddingVertical: scaleSize(20), borderRadius: scaleSize(16), minHeight: scaleSize(60) },
  appleBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(20), color: '#fff' },
  googleBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(20), color: '#222' },
  icon: { width: scaleSize(26), height: scaleSize(26) },
  errorText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(14), color: '#b91c1c', marginTop: scaleSize(16), textAlign: 'center' },
  phoneLink: { marginTop: scaleSize(20), paddingVertical: scaleSize(8), alignSelf: 'center' },
  phoneLinkText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(16), color: '#333', textDecorationLine: 'underline' },
});
