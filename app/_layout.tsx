import { useFonts, Fredoka_400Regular } from '@expo-google-fonts/fredoka';
import { FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox, View } from 'react-native';

LogBox.ignoreLogs(['Failed to initialize reCAPTCHA Enterprise']);
import { AuthProvider } from '@/lib/auth-store';
import {
  SuperwallAvailableContext,
  SuperwallProvider,
} from '@/lib/superwall';

SplashScreen.preventAutoHideAsync();

const SUPERWALL_IOS_KEY = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY ?? '';
const SUPERWALL_ANDROID_KEY = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, FredokaOne_400Regular });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const content = (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="login" options={{ headerShown: true, title: 'Login' }} />
        </Stack>
      </View>
    </AuthProvider>
  );

  const apiKeys: { ios?: string; android?: string } = {
    ...(SUPERWALL_IOS_KEY && { ios: SUPERWALL_IOS_KEY }),
    ...(SUPERWALL_ANDROID_KEY && { android: SUPERWALL_ANDROID_KEY }),
  };

  console.log('[RootLayout] SuperwallProvider available:', !!SuperwallProvider);
  console.log('[RootLayout] API keys configured:', {
    hasIOS: !!SUPERWALL_IOS_KEY,
    hasAndroid: !!SUPERWALL_ANDROID_KEY,
    keys: apiKeys,
  });

  if (SuperwallProvider) {
    return (
      <SuperwallProvider
        apiKeys={apiKeys}
        onConfigurationError={(e: any) => {
          console.error('[RootLayout] Superwall config failed:', e);
        }}
      >
        <SuperwallAvailableContext.Provider value={true}>{content}</SuperwallAvailableContext.Provider>
      </SuperwallProvider>
    );
  }
  console.warn('[RootLayout] SuperwallProvider not available, Superwall disabled');
  return <SuperwallAvailableContext.Provider value={false}>{content}</SuperwallAvailableContext.Provider>;
}
