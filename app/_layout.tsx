import '@/lib/dom-polyfills';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { registerGlobals } from '@livekit/react-native';
import { useFonts, Fredoka_400Regular } from '@expo-google-fonts/fredoka';
import { FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

registerGlobals();

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
import { SplashTransition } from '@/components/SplashTransition';

LogBox.ignoreLogs(['Failed to initialize reCAPTCHA Enterprise']);
import { AuthProvider } from '@/lib/auth-store';
import { initAnalytics } from '@/lib/analytics';
import React from 'react';
import {
  PaywallTriggerProvider as PaywallTriggerProviderRaw,
  SuperwallAvailableContext,
  SuperwallProvider,
} from '@/lib/superwall';

const PaywallTriggerProvider = PaywallTriggerProviderRaw as React.ComponentType<{ children: React.ReactNode }>;

SplashScreen.preventAutoHideAsync();

const SUPERWALL_IOS_KEY = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY ?? '';
const SUPERWALL_ANDROID_KEY = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, FredokaOne_400Regular });
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    requestTrackingPermissionsAsync();
  }, []);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !__DEV__) return;
    try {
      const sw = require('expo-superwall');
      sw.SuperwallExpoModule?.reset?.().then(() => {
        console.log('[DEV] Superwall reset() called — experiment assignments cleared');
      }).catch((e: any) => console.warn('[DEV] Superwall reset() failed:', e));
    } catch {}
  }, [fontsLoaded]);

  const content = (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <PaywallTriggerProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#FFFFFF' } }}>
            <Stack.Screen name="login" options={{ headerShown: true, title: 'Login' }} />
            <Stack.Screen name="avatar-tutor" options={{ animation: 'slide_from_bottom', headerShown: false, gestureEnabled: false }} />
            {[
              'index',
              'students-improve',
              'where-study',
              'user-type',
              'professional-welcome',
              'social-proof',
              'subjects',
              'study-duration',
              'notification-optin',
              'current-gpa',
              'target-gpa',
              'plan-usage',
              'creating-plan',
              'plan-ready',
              'micro-quiz',
              'quiz-results',
              'record',
              'flashcards',
              'instantanswers',
              'quizzes',
              'professional-home',
              'professional-note-detail',
            ].map((name) => (
              <Stack.Screen key={name} name={name} options={{ animation: 'none' }} />
            ))}
          </Stack>
        </PaywallTriggerProvider>
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

  const splash = splashMounted ? (
    <SplashTransition fontsReady={fontsLoaded} onDone={() => setSplashMounted(false)} />
  ) : null;

  if (SuperwallProvider) {
    return (
      <>
        <SuperwallProvider
          apiKeys={apiKeys}
          onConfigurationError={(e: any) => {
            console.error('[RootLayout] Superwall config failed:', e);
          }}
        >
          <SuperwallAvailableContext.Provider value={true}>{content}</SuperwallAvailableContext.Provider>
        </SuperwallProvider>
        {splash}
      </>
    );
  }
  console.warn('[RootLayout] SuperwallProvider not available, Superwall disabled');
  return (
    <>
      <SuperwallAvailableContext.Provider value={false}>{content}</SuperwallAvailableContext.Provider>
      {splash}
    </>
  );
}
