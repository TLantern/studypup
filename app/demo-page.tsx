import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ProgressBar } from '@/components/ProgressBar';
import { scaleFont, scaleSize, RESPONSIVE } from '@/lib/responsive';
import { useFocusEffect } from '@react-navigation/native'
import { useSharedVideoPlayer } from '@/lib/videoPlayer'
import { trackEvent } from '@/lib/mixpanel'


const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

export default function DemoPageScreen() {
  const insets = useSafeAreaInsets();
  const isIpad = Platform.OS === 'ios' && Platform.isPad;
  const [canContinue, setCanContinue] = useState(false);
  const fillProgress = useSharedValue(0);

  const player = useSharedVideoPlayer()
  
  console.log('[INIT] status:', player.status);
  
const hasStarted = useRef(false)
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
const tracked = useRef(false)
useEffect(() => {
  if (!tracked.current) {
    trackEvent('demo-page')
    tracked.current = true
  }
}, [])

useFocusEffect(
  useCallback(() => {
    setCanContinue(false)
    fillProgress.value = 0
    hasStarted.current = false

    console.log('[FOCUS] screen entered')

    const statusSub = player.addListener('statusChange', (e: {status: string}) => {
      console.log('[STATUS]', e.status)

      if (e.status === 'readyToPlay' && !hasStarted.current) {
        hasStarted.current = true

        console.log('[ACTION] instant play')

        try {
          player.currentTime = 0
          player.play()
        } catch (_) {}
      }
    })

    intervalRef.current = setInterval(() => {
      try {
        const duration = player.duration
        const current = player.currentTime

        if (duration > 0) {
          const p = Math.min((current / duration) * 1.3, 1.3)
          fillProgress.value = withTiming(p, { duration: 150 })
          if (p >= 1) setCanContinue(true)
        }
      } catch (_) {}
    }, 100)

    const endSub = player.addListener('playToEnd', () => {
      fillProgress.value = withTiming(1.3, { duration: 150 })
      setCanContinue(true)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    })

    return () => {
      try { player.pause() } catch (_) {}

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      statusSub.remove()
      endSub.remove()
    }
  }, [player])
)

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value * 100}%`,
  }));

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.progressWrap}><ProgressBar progress={10} /></View>
        <Text style={styles.heading}>Upload. Learn. Improve.</Text>
        <View style={styles.heroWrap}>
          <View style={[styles.videoShadowWrap, isIpad && styles.videoShadowWrapIpad]}>
            <View style={styles.videoBorder} collapsable={false}>
              <VideoView
                player={player}
                style={styles.video}
                contentFit="contain"
                nativeControls={false}
              />
            </View>
          </View>
        </View>
        <View style={styles.buttons}>
          <Pressable
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            onPress={() => canContinue && router.push('/grade-level' as never)}
            disabled={!canContinue}
          >
            <Animated.View style={[styles.btnFill, fillStyle]} />
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: RESPONSIVE.horizontalPadding },
  progressWrap: { width: '100%', marginBottom: scaleSize(16) },
  heading: { fontFamily: 'Fredoka', fontWeight: '600', fontSize: scaleFont(32), color: '#000', textAlign: 'center', marginBottom: scaleSize(10) },
  heroWrap: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', width: '100%', marginTop: scaleSize(4) },
  videoShadowWrap: {
    width: '70%',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  videoShadowWrapIpad: {
    width: '42%',
    marginTop: scaleSize(48),
  },
  videoBorder: {
    width: '100%',
    aspectRatio: 9.2 / 18.8,
    borderRadius: 50,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    aspectRatio: 9.2 / 18.8,
    overflow: 'hidden',
  },
  buttons: { marginTop: 'auto', paddingTop: scaleSize(6) },
  btn: {
    borderRadius: RESPONSIVE.buttonRadius,
    paddingVertical: RESPONSIVE.buttonPaddingVertical,
    paddingHorizontal: RESPONSIVE.buttonPaddingHorizontal,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(253,138,138,0.25)',
    borderColor: '#CA6E6E',
    overflow: 'hidden',
    ...BUTTON_SHADOW,
  },
  btnDisabled: { opacity: 0.7 },
  btnFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FD8A8A',
  },
  btnText: { fontFamily: 'Fredoka_400Regular', fontSize: RESPONSIVE.button, zIndex: 1 },
  btnPrimaryText: { color: '#fff' },
});
