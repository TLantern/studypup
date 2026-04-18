import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { OnboardingView } from '@/components/OnboardingView';
import { trackPageViewed } from '@/lib/analytics';
import { SCREEN_WIDTH } from '@/lib/responsive';

const IS_IPAD = SCREEN_WIDTH >= 768;

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function StudentsImproveScreen() {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const [showEndContent, setShowEndContent] = useState(false);
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    trackPageViewed('onboarding_students_improve');
    lottieRef.current?.play();
  }, []);

  const onAnimationFinish = () => {
    setShowEndContent(true);
    fadeAnim.value = withTiming(1, { duration: 500 });
  };

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + 84, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Students Boost Grades with StudyPup</Text>
      <View style={styles.lottieWrap}>
        <LottieView
          ref={lottieRef}
          source={require('../Bar chart with arrow and a star.json')}
          style={styles.lottie}
          loop={false}
          onAnimationFinish={onAnimationFinish}
        />
      </View>
      {showEndContent && (
        <>
          <Animated.View style={[styles.endWrap, fadeStyle]}>
            <Text style={styles.endText}>Consistent practice without extra effort</Text>
          </Animated.View>
          <Animated.View style={[styles.buttons, fadeStyle]}>
            <Pressable style={styles.btn} onPress={() => router.push('/where-study')}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>Continue</Text>
            </Pressable>
          </Animated.View>
        </>
      )}
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'FredokaOne_400Regular',
    fontSize: IS_IPAD ? 34 : 28,
    color: '#000',
    textAlign: 'center',
    marginBottom: 14,
  },
  lottieWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 280,
  },
  lottie: {
    width: 480,
    height: 480,
  },
  endWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  endText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
  },
  buttons: {
    marginTop: 'auto',
    paddingTop: 6,
  },
  btn: {
    borderRadius: 35,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  btnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 24,
  },
  btnPrimaryText: {
    color: '#fff',
  },
});
