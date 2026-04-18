import React from 'react';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

export function OnboardingView({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInUp.duration(350)}
      exiting={FadeOutDown.duration(280)}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}
