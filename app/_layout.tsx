import { useFonts, Fredoka_400Regular, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
import { LogBox, View } from 'react-native';

LogBox.ignoreLogs(['Failed to initialize reCAPTCHA Enterprise']);
import { AuthProvider, useAuth } from '@/lib/auth-store';
import { mixpanel } from '@/lib/mixpanel';
import { VideoPlayerProvider } from '@/lib/videoPlayer';
import React from 'react';
import {
  PaywallTriggerProvider as PaywallTriggerProviderRaw,
  SuperwallAvailableContext,
  SuperwallProvider,
} from '@/lib/superwall';

const PaywallTriggerProvider = PaywallTriggerProviderRaw as React.ComponentType<{ children: React.ReactNode }>;

SplashScreen.preventAutoHideAsync();

function PageViewTracker() {
  const pathname = usePathname();
  const { uid } = useAuth();
  useEffect(() => {
    if (pathname) {
      mixpanel.track('Page View', { page_url: pathname, page_title: pathname, user_id: uid ?? undefined });
    }
  }, [pathname, uid]);
  return null;
}

const SUPERWALL_IOS_KEY = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY ?? '';
const SUPERWALL_ANDROID_KEY = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, Fredoka_600SemiBold, FredokaOne_400Regular, Fredoka: require('../assets/fonts/Fredoka.ttf') });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const content = (
    <AuthProvider>
      <PageViewTracker />
      <VideoPlayerProvider>
        <View style={{ flex: 1 }}>
          <PaywallTriggerProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="login" options={{ headerShown: true, title: 'Login' }} />
          </Stack>
        </PaywallTriggerProvider>
        </View>
      </VideoPlayerProvider>
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
