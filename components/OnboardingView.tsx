import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { isTablet, MAX_CONTENT_WIDTH } from '@/lib/responsive';

export function OnboardingView({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInUp.duration(350)}
      exiting={FadeOutDown.duration(280)}
      style={{ flex: 1 }}
    >
      {isTablet ? (
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH }}>
            {children}
          </View>
        </View>
      ) : children}
    </Animated.View>
  );
}
