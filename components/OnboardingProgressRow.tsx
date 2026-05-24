import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { scaleSize, scaleFont } from '@/lib/responsive';

interface Props {
  progress: number; // 0 to 1
  onBack?: () => void;
  onSkip?: () => void;
}

export function OnboardingProgressRow({ progress, onBack, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const fillWidth = useSharedValue(Math.max(0, progress - 0.1));

  useEffect(() => {
    fillWidth.value = withTiming(progress, { duration: 400 });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value * 100}%`,
  }));

  return (
    <View style={[styles.row, { paddingTop: insets.top + scaleSize(24), paddingHorizontal: scaleSize(24) }]}>
      <Pressable style={styles.backBtn} onPress={onBack ?? (() => router.back())} hitSlop={8}>
        <Ionicons name="chevron-back" size={28} color={DEEP_BLACK} />
      </Pressable>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      {onSkip && (
        <Pressable onPress={onSkip} hitSlop={12} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(8),
    paddingBottom: scaleSize(36),
    backgroundColor: '#FFFFFF',
  },
  backBtn: { padding: scaleSize(4) },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6,
  },
  fill: {
    height: '100%',
    backgroundColor: ACCENT_BLUE,
    borderRadius: 6,
  },
  skipBtn: { paddingHorizontal: scaleSize(4) },
  skipText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: 'rgba(0,0,0,0.4)',
  },
});
