import * as Haptics from 'expo-haptics';

export const hapticSelect = () => {
  Haptics.selectionAsync().catch(() => {});
};

export const hapticContinue = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};
