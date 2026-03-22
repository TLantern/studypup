import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';

const trackAutomaticEvents = false;
const useNative = false; // Expo / JS mode

export const mixpanel = new Mixpanel(TOKEN, trackAutomaticEvents, useNative);
mixpanel.init();

export function getMixpanel() {
  return mixpanel;
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  mixpanel.track(name, props);
}
