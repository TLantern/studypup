import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SuperwallAvailableContext } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { hapticContinue } from '@/lib/haptics';
import { useAuth } from '@/lib/auth-store';
import { scaleFont, scaleSize, scaleVertical, SCREEN_WIDTH, isSmallDevice } from '@/lib/responsive';
import { OnboardingView } from '@/components/OnboardingView';
import LottieView from 'lottie-react-native';
import { welcomeIconRef } from '@/lib/welcomeIconRef';
import { isPaywallBypassed, togglePaywallBypassed } from '@/lib/dev-bypass';

const DEEP_BLACK = '#0D0D0F';
const OFF_WHITE = '#F7F7F5';
const ACCENT_BLUE = '#7FA8FF';
const SILVER = '#C9CCD1';

const SF_PRO = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const ICON_SIZE = Math.min(SCREEN_WIDTH * 0.22, 96);
const LOTTIE_ASPECT = 572 / 965;
const WAVE_HEIGHT = SCREEN_WIDTH * LOTTIE_ASPECT * 2.2;


export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { uid, loading } = useAuth();
  useContext(SuperwallAvailableContext);

  const iconMeasureRef = useRef<View>(null);
  const lottieRef = useRef<LottieView>(null);
  const [speed, setSpeed] = useState(4);
  const phase = useRef<'fast' | 'slow'>('fast');

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1500);
    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      togglePaywallBypassed().then(() => {
        const on = isPaywallBypassed();
        Alert.alert('Dev mode', `Paywall bypass ${on ? 'ON' : 'OFF'}`);
      });
    }
  }, []);

  useEffect(() => {
    console.log('[Wave] mount effect — lottieRef:', !!lottieRef.current);
    const timer = setTimeout(() => {
      console.log('[Wave] playing fast segment, ref:', !!lottieRef.current);
      lottieRef.current?.play(0, 120);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const onWaveSegmentFinish = useCallback((cancelled: boolean) => {
    console.log('[Wave] segment finished, cancelled:', cancelled, 'phase:', phase.current);
    if (!cancelled && phase.current === 'fast') {
      phase.current = 'slow';
      setSpeed(0.5);
      setTimeout(() => {
        console.log('[Wave] playing slow segment');
        lottieRef.current?.play(120, 300);
      }, 50);
    }
  }, []);

  useEffect(() => {
    trackPageViewed('ob_shared_welcome');
  }, []);

  useEffect(() => {
    if (!loading && uid) {
      router.replace('/(tabs)');
    }
  }, [uid, loading]);

  if (loading || uid) {
    return null;
  }

  return (
    <OnboardingView>
      <View style={[styles.container, { paddingTop: insets.top + scaleVertical(isSmallDevice ? 60 : 130) }]}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.headerBlock}>
          <Pressable onPress={handleTitleTap}>
            <Text style={styles.title}>
              <Text style={styles.titleAccent}>Capture</Text>
              <Text style={styles.titleRest}> what matters</Text>
            </Text>
          </Pressable>
        </Animated.View>

        <View
          ref={iconMeasureRef}
          style={styles.iconShadow}
          onLayout={() => {
            iconMeasureRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
              welcomeIconRef.set({ x: pageX, y: pageY, width: w, height: h });
            });
          }}
        >
          <View style={styles.iconWrap}>
            <Image
              source={require('../assets/images/notario-icon.png')}
              style={styles.icon}
              contentFit="cover"
            />
          </View>
        </View>


        <View style={styles.waveWrap} pointerEvents="none">
          <LottieView
            ref={(r) => {
              (lottieRef as any).current = r;
              console.log('[Wave] LottieView ref set:', !!r);
            }}
            source={require('../Abstract Waves.json')}
            loop={false}
            speed={speed}
            style={styles.lottie}
            resizeMode="cover"
            onAnimationFinish={onWaveSegmentFinish}
            onAnimationLoaded={() => console.log('[Wave] animation loaded')}
            onAnimationFailure={(e) => console.log('[Wave] animation FAILED:', e)}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + scaleSize(20) }]}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => { hapticContinue(); router.push('/user-type'); }}
          >
            <Text style={styles.ctaText}>Get Started</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace({ pathname: '/create-account', params: { mode: 'login' } })}
            style={styles.loginWrap}
            hitSlop={12}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </OnboardingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OFF_WHITE,
    alignItems: 'center',
  },
  headerBlock: {
    paddingHorizontal: scaleSize(24),
    alignItems: 'center',
  },
  title: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(28),
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  titleAccent: {
    color: ACCENT_BLUE,
    fontWeight: '700',
  },
  titleRest: {
    color: DEEP_BLACK,
    fontWeight: '700',
  },
  iconShadow: {
    marginTop: scaleSize(20),
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.26,
    backgroundColor: DEEP_BLACK,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.26,
    overflow: 'hidden',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  waveWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: scaleVertical(isSmallDevice ? 60 : 100),
    height: WAVE_HEIGHT,
    width: SCREEN_WIDTH,
    overflow: 'hidden',
  },
  lottie: {
    width: SCREEN_WIDTH * 1.2,
    height: WAVE_HEIGHT,
    marginLeft: -SCREEN_WIDTH * 0.1,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scaleSize(24),
    alignItems: 'stretch',
    gap: scaleSize(14),
  },
  cta: {
    backgroundColor: ACCENT_BLUE,
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(18),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  ctaText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  loginWrap: {
    alignItems: 'center',
    paddingVertical: scaleSize(8),
  },
  loginText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: DEEP_BLACK,
    fontWeight: '400',
  },
  loginLink: {
    fontFamily: SF_PRO,
    fontWeight: '600',
    color: DEEP_BLACK,
    textDecorationLine: 'underline',
  },
});
