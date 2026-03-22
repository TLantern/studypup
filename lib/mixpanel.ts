import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '4d1e297e80cb017392985a92b6b5d62b';

const trackAutomaticEvents = false;
const useNative = false; // Expo / JS mode

export const mixpanel = new Mixpanel(TOKEN, trackAutomaticEvents, useNative);
mixpanel.init();

export function getMixpanel() {
  return mixpanel;
}
