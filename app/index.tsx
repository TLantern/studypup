import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useContext, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SuperwallAvailableContext, useUserSafe } from '@/lib/superwall'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  scaleFont,
  scaleSize,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  RESPONSIVE,
} from '@/lib/responsive'
import { useAuth } from '@/lib/auth-store'
import { mixpanel, trackEvent } from '@/lib/mixpanel'
import { useSharedVideoPlayer } from '@/lib/videoPlayer'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated'
import { signInWithApple, signInWithGoogle } from '@/lib/auth'
import ShineButton from '@/components/ShineButton'

const SHEET_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 4,
}

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
}

const ENTRANCE_OFFSET = 280
const ENTRANCE_DURATION = 600
const IDLE_CIRCLE_RADIUS = 10
const IDLE_CIRCLE_DURATION = 4000
const IDLE_SCALE_DELTA = 0.02
const TWO_PI = 2 * Math.PI

function useLogoAnimation() {
  const entrance = useSharedValue(0)
  const idleAngle = useSharedValue(0)

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: ENTRANCE_DURATION,
      easing: Easing.out(Easing.cubic),
    })

    idleAngle.value = withRepeat(
      withTiming(TWO_PI, {
        duration: IDLE_CIRCLE_DURATION,
        easing: Easing.linear,
      }),
      -1,
      false
    )
  }, [])

  return useAnimatedStyle(() => {
    const angle = idleAngle.value
    return {
      transform: [
        {
          translateX:
            (1 - entrance.value) * -ENTRANCE_OFFSET +
            IDLE_CIRCLE_RADIUS * Math.cos(angle),
        },
        {
          translateY:
            (1 - entrance.value) * ENTRANCE_OFFSET +
            IDLE_CIRCLE_RADIUS * Math.sin(angle),
        },
        { scale: 1 + IDLE_SCALE_DELTA * Math.sin(angle) },
      ],
    }
  })
}

const WELCOME_RESPONSIVE = {
  titleFontSize: scaleFont(36),
  logoSize: Math.min(SCREEN_WIDTH * 0.5, 200),
  userChoiceBadgeWidth: SCREEN_WIDTH * 0.9,
  userChoiceBadgeHeight: scaleSize(75),
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const logoStyle = useLogoAnimation()
  const superwallAvailable = useContext(SuperwallAvailableContext)
  const { subscriptionStatus } = useUserSafe()
  const isPro = subscriptionStatus?.status === 'ACTIVE'
  const { uid, loading } = useAuth()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [authLoading, setAuthLoading] = useState<'apple' | 'google' | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const sheetTranslate = useSharedValue(SCREEN_HEIGHT)

  const player = useSharedVideoPlayer()

  useEffect(() => {
    sheetTranslate.value = withTiming(sheetVisible ? 0 : SCREEN_HEIGHT, { duration: 300, easing: Easing.out(Easing.cubic) })
  }, [sheetVisible])

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }))

  const handleApple = async () => {
    setAuthLoading('apple')
    setAuthError(null)
    try {
      await signInWithApple()
      setSheetVisible(false)
    } catch (e: any) {
      const code = e?.code ?? e?.nativeEvent?.code
      if (code !== 'ERR_REQUEST_CANCELED' && code !== 1000) setAuthError(e?.message ?? 'Apple sign-in failed.')
    } finally {
      setAuthLoading(null)
    }
  }

  const handleGoogle = async () => {
    setAuthLoading('google')
    setAuthError(null)
    try {
      await signInWithGoogle()
      setSheetVisible(false)
    } catch (e: any) {
      if (e?.message !== 'Google sign-in cancelled.') setAuthError(e?.message ?? 'Google sign-in failed.')
    } finally {
      setAuthLoading(null)
    }
  }

  const handlePhone = () => {
    setSheetVisible(false)
    router.push(superwallAvailable ? { pathname: '/create-account', params: { then: 'paywall' } } : '/create-account')
  }

  // ✅ PRELOAD (correct place)
  useEffect(() => {
    try {
      player.play()
      player.pause()
      console.log('[PRELOAD] video warmed')
    } catch {}
  }, [])

  // auth redirect
  useEffect(() => {
    if (!loading && uid) {
      router.replace(superwallAvailable && !isPro ? '/paywall' : '/(tabs)')
    }
  }, [uid, loading, superwallAvailable, isPro])

  const welcomeTracked = useRef(false)
  useEffect(() => {
    if (loading || uid) return
    if (!welcomeTracked.current) {
      trackEvent('Welcome')
      welcomeTracked.current = true
    }
  }, [loading, uid])

  if (loading || uid) return null

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Welcome to{'\n'}Studypup!</Text>
      <Text style={styles.subtext}>Unlock Your Academic Potential.</Text>

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require('../assets/images/puppylogoo.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>

      <View style={styles.userChoiceRow}>
        <Image
          source={require('../assets/icons/userchoice.png')}
          style={styles.userChoiceBadge}
          contentFit="contain"
        />
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => {
            try {
              player.play() // keep warm
            } catch {}
            mixpanel.track('Conversion', { 'Conversion Type': 'Get Started' })
            router.push('/demo-page')
          }}
        >
          <Text style={[styles.btnText, styles.btnPrimaryText]}>
            Get Started
          </Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.btnLogin]} onPress={() => setSheetVisible(true)}>
          <Text style={[styles.btnText, styles.btnLoginText]}>Login</Text>
        </Pressable>
      </View>

      <Modal visible={sheetVisible} transparent animationType="none">
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetVisible(false)} />
          <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + scaleSize(24) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Welcome back</Text>
            <View style={styles.sheetButtons}>
              {Platform.OS === 'ios' && (
                <ShineButton
                  label=""
                  onPress={handleApple}
                  backgroundColor="#000"
                  textColor="#fff"
                  style={[styles.sheetBtn, SHEET_SHADOW]}
                  disabled={!!authLoading}
                >
                  <Image source={require('../assets/icons/apple.png')} style={styles.sheetIcon} contentFit="contain" tintColor="#fff" />
                  <Text style={styles.sheetBtnText}>Continue with Apple</Text>
                  {authLoading === 'apple' && <ActivityIndicator color="#fff" size="small" />}
                </ShineButton>
              )}
              <ShineButton
                label=""
                onPress={handleGoogle}
                backgroundColor="#fff"
                textColor="#222"
                borderColor="#ddd"
                borderWidth={1}
                style={[styles.sheetBtn, SHEET_SHADOW]}
                disabled={!!authLoading}
              >
                <Image source={require('../assets/icons/google.png')} style={styles.sheetIcon} contentFit="contain" />
                <Text style={[styles.sheetBtnText, styles.sheetBtnTextDark]}>Continue with Google</Text>
                {authLoading === 'google' && <ActivityIndicator color="#333" size="small" />}
              </ShineButton>
              <ShineButton
                label=""
                onPress={handlePhone}
                backgroundColor="#E8E8E8"
                textColor="#000"
                borderColor="#B9B9B9"
                borderWidth={1}
                style={[styles.sheetBtn, SHEET_SHADOW]}
                disabled={!!authLoading}
              >
                <Text style={[styles.sheetBtnText, styles.sheetBtnTextDark]}>Continue with phone number</Text>
              </ShineButton>
            </View>
            {authError ? <Text style={styles.sheetError}>{authError}</Text> : null}
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#AADDDD',
    paddingHorizontal: RESPONSIVE.containerPadding,
  },
  title: {
    fontFamily: 'Fredoka',
    fontWeight: '600',
    fontSize: WELCOME_RESPONSIVE.titleFontSize,
    color: '#000',
    textAlign: 'center',
  },
  subtext: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(20),
    color: '#333',
    textAlign: 'center',
    marginTop: scaleSize(8),
  },
  logoWrap: {
    alignSelf: 'center',
    marginVertical: scaleSize(24),
  },
  logo: {
    width: WELCOME_RESPONSIVE.logoSize,
    height: WELCOME_RESPONSIVE.logoSize,
  },
  userChoiceRow: {
    alignItems: 'center',
    marginTop: scaleSize(-16),
    marginBottom: scaleSize(8),
  },
  userChoiceBadge: {
    width: WELCOME_RESPONSIVE.userChoiceBadgeWidth,
    height: WELCOME_RESPONSIVE.userChoiceBadgeHeight,
  },
  buttons: {
    gap: scaleSize(16),
    paddingTop: SCREEN_HEIGHT * 0.12,
  },
  btn: {
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: scaleSize(16),
    alignItems: 'center',
    borderWidth: 1,
    ...BUTTON_SHADOW,
  },
  btnPrimary: {
    backgroundColor: '#FD8A8A',
    borderColor: '#CA6E6E',
  },
  btnLogin: {
    backgroundColor: '#E8E8E8',
    borderColor: '#B9B9B9',
  },
  btnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(22),
  },
  btnPrimaryText: { color: '#fff' },
  btnLoginText: { color: '#000' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#AADDDD',
    borderTopLeftRadius: scaleSize(20),
    borderTopRightRadius: scaleSize(20),
    paddingHorizontal: SCREEN_WIDTH * 0.06,
    paddingTop: scaleSize(12),
    ...BUTTON_SHADOW,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#999',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: scaleSize(20),
  },
  sheetTitle: {
    fontFamily: 'Fredoka',
    fontWeight: '600',
    fontSize: scaleFont(22),
    color: '#000',
    textAlign: 'center',
    marginBottom: scaleSize(16),
  },
  sheetButtons: { gap: scaleSize(14) },
  sheetBtn: {
    paddingVertical: scaleSize(14),
    borderRadius: scaleSize(14),
    minHeight: scaleSize(52),
  },
  sheetIcon: { width: scaleSize(22), height: scaleSize(22) },
  sheetBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: scaleFont(17), color: '#fff' },
  sheetBtnTextDark: { color: '#222' },
  sheetError: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(13),
    color: '#b91c1c',
    marginTop: scaleSize(12),
    textAlign: 'center',
  },
})