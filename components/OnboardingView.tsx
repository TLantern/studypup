import React from 'react';
import { View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { isTablet, MAX_CONTENT_WIDTH } from '@/lib/responsive';

interface Props {
  children: React.ReactNode;
  header?: React.ReactNode;
}

export function OnboardingView({ children, header }: Props) {
  const content = isTablet ? (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH }}>
        {children}
      </View>
    </View>
  ) : children;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {header && <View>{header}</View>}
      <Animated.View entering={SlideInRight.duration(280)} style={{ flex: 1 }}>
        {content}
      </Animated.View>
    </View>
  );
}
