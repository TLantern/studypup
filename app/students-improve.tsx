import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { OnboardingView } from '@/components/OnboardingView';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';
import { getOnboarding } from '@/lib/onboarding-storage';
import { ACCENT_BLUE, DEEP_BLACK, SF_PRO, sharedStyles } from '@/lib/onboarding-theme';
import { SCREEN_WIDTH } from '@/lib/responsive';

const SUBJECT_LABELS: Record<string, string> = {
  biology: 'Biology',
  cs: 'Computer Science',
  math: 'Math',
  history: 'History',
  geography: 'Geography',
  music: 'Music',
  chemistry: 'Chemistry',
  religious: 'Religious Studies',
};

const COUNTS = ['5,000', '6,200', '7,500', '8,100', '9,300', '10,000'];
const randomCount = () => COUNTS[Math.floor(Math.random() * COUNTS.length)];

const IS_IPAD = SCREEN_WIDTH >= 768;


export default function StudentsImproveScreen() {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const [showEndContent, setShowEndContent] = useState(false);
  const fadeAnim = useSharedValue(0);
  const [title, setTitle] = useState('Students have boosted their grades with Notario');

  useEffect(() => {
    trackPageViewed('ob_student_social_proof');
    lottieRef.current?.play();
    getOnboarding().then(({ subjects }) => {
      const subject = subjects?.[0] ? SUBJECT_LABELS[subjects[0]] ?? subjects[0] : null;
      const count = randomCount();
      setTitle(
        subject
          ? `Over ${count} ${subject} students have boosted their grades with Notario`
          : `Over ${count} students have boosted their grades with Notario`
      );
    });
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
      <Text style={styles.title}>{title}</Text>
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
            <Pressable style={styles.btn} onPress={() => { hapticContinue(); router.push('/study-duration'); }}>
              <Text style={styles.btnText}>Continue</Text>
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
    fontFamily: SF_PRO,
    fontSize: IS_IPAD ? 26 : 22,
    fontWeight: '700',
    color: DEEP_BLACK,
    textAlign: 'center',
    letterSpacing: -0.5,
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
    fontFamily: SF_PRO,
    fontSize: 17,
    fontWeight: '500',
    color: '#555',
    textAlign: 'center',
  },
  buttons: {
    marginTop: 'auto',
    paddingTop: 6,
  },
  btn: sharedStyles.continueBtn,
  btnText: sharedStyles.continueBtnText,
  btnPrimaryText: {},
});
