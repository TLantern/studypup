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
import { AuthProvider, useAuth } from '@/lib/auth-store';
import { startProNotesSync } from '@/lib/pro-note-store';
import { startRecordingErrorsSync } from '@/lib/recording-pipeline';
import { hydratePaywallBypass } from '@/lib/dev-bypass';
import { initAnalytics } from '@/lib/analytics';
import { PostHogProvider } from 'posthog-react-native';
import React from 'react';
import {
  PaywallTriggerProvider as PaywallTriggerProviderRaw,
  SuperwallAvailableContext,
  SuperwallProvider,
} from '@/lib/superwall';

const PaywallTriggerProvider = PaywallTriggerProviderRaw as React.ComponentType<{ children: React.ReactNode }>;

/**
 * Keeps a realtime listener on the signed-in user's notes running app-wide so
 * server-written notes (Path B: ≥5 min recordings processed by the Cloud
 * Function) stream in and clear their "Processing…" card without reopening a
 * specific screen. Restarts on user change; tears down on sign-out.
 */
function ProNotesSync() {
  const { uid } = useAuth();
  useEffect(() => {
    if (!uid) return;
    const unsubNotes = startProNotesSync();
    const unsubErrors = startRecordingErrorsSync();
    return () => {
      unsubNotes();
      unsubErrors();
    };
  }, [uid]);
  return null;
}

SplashScreen.preventAutoHideAsync();

const SUPERWALL_IOS_KEY = process.env.EXPO_PUBLIC_SUPERWALL_IOS_KEY ?? '';
const SUPERWALL_ANDROID_KEY = process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_KEY ?? '';
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';

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
    hydratePaywallBypass();
  }, []);

  const content = (
    <AuthProvider>
      <ProNotesSync />
      <View style={{ flex: 1 }}>
        <PaywallTriggerProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#FFFFFF' } }}>
            <Stack.Screen name="login" options={{ headerShown: true, title: 'Login' }} />
            <Stack.Screen name="avatar-tutor" options={{ animation: 'slide_from_bottom', headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="capture-meeting" options={{ animation: 'slide_from_bottom', headerShown: false, gestureEnabled: true }} />
            {[
              'index',
              'students-improve',
              'where-study',
              'user-type',
              'professional-welcome',
              'social-proof',
              'subjects',
              'current-gpa',
              'target-gpa',
              'gpa-projection',
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
              'viral-professional-home',
              'viral-professional-note-detail',
              'viral-transcribing',
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

  const wrapPostHog = (children: React.ReactNode) =>
    POSTHOG_API_KEY ? (
      <PostHogProvider apiKey={POSTHOG_API_KEY} options={{ host: 'https://us.i.posthog.com' }}>
        {children}
      </PostHogProvider>
    ) : (
      <>{children}</>
    );

  if (SuperwallProvider) {
    return wrapPostHog(
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
      </>,
    );
  }
  console.warn('[RootLayout] SuperwallProvider not available, Superwall disabled');
  return wrapPostHog(
    <>
      <SuperwallAvailableContext.Provider value={false}>{content}</SuperwallAvailableContext.Provider>
      {splash}
    </>,
  );
}
