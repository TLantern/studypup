import { NativeModules, Platform } from 'react-native';

const { TikTokAnalyticsModule } = NativeModules;

function isAvailable() {
  return Platform.OS === 'ios' && !!TikTokAnalyticsModule;
}

export function ttTrackRegistration() {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.trackEvent('Registration');
}

export function ttTrackLogin() {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.trackEvent('Login');
}

export function ttTrackSubscribe() {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.trackEvent('Subscribe');
}

export function ttTrackStartTrial() {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.trackEvent('StartTrial');
}

export function ttTrackCompleteTutorial() {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.trackEvent('CompleteTutorial');
}

export function ttTrackPurchase(value: string, currency = 'USD', contentId = '', contentName = '') {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.trackPurchase(value, currency, contentId, contentName);
}

export function ttIdentify(externalId: string, email = '', phoneNumber = '') {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.identify(externalId, email, phoneNumber);
}

export function ttLogout() {
  if (!isAvailable()) return;
  TikTokAnalyticsModule.logout();
}
