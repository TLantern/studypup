import { getMaterials } from '@/lib/study-materials-storage';
import { generateIntroScript, generateAvatarResponse } from '@/lib/avatarScriptService';
import { elevenLabsPCMStream } from '@/lib/elevenlabs';
import { useLiveAvatarSession } from '@/lib/useLiveAvatarSession';
import { useAvatarSTT } from '@/lib/useAvatarSTT';
import { scaleFont, scaleSize } from '@/lib/responsive';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from '@livekit/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Phase = 'loading' | 'connecting' | 'intro' | 'listening' | 'thinking' | 'responding' | 'error';

const PHASE_LABELS: Record<Phase, string> = {
  loading: 'Preparing your session...',
  connecting: 'Connecting to avatar...',
  intro: 'Tutor is speaking...',
  listening: 'Listening — ask anything',
  thinking: 'Thinking...',
  responding: 'Responding...',
  error: 'Something went wrong',
};

export default function AvatarTutorScreen() {
  const insets = useSafeAreaInsets();
  const { materialId } = useLocalSearchParams<{ materialId?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const notesRef = useRef<string>('');

  const { sessionState, videoTrack, connect, streamAudioChunk, interrupt, disconnect } =
    useLiveAvatarSession();
  const { isListening, startListening, stopListening } = useAvatarSTT();

  const speakText = useCallback(
    async (text: string) => {
      await elevenLabsPCMStream(text, (chunk) => streamAudioChunk(chunk));
    },
    [streamAudioChunk]
  );

  // Mount: load material → generate intro → connect avatar → speak intro
  useEffect(() => {
    if (!materialId) {
      setPhase('error');
      setErrorMsg('No study material provided.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const material = await getMaterials(materialId);
        if (cancelled) return;
        if (!material) throw new Error('Study material not found.');

        const title = material.title ?? 'this topic';
        const notes = material.notes ?? '';
        notesRef.current = notes;

        const script = await generateIntroScript(title, notes);
        if (cancelled) return;

        setPhase('connecting');
        await connect();
        if (cancelled) return;

        setPhase('intro');
        await speakText(script);
        if (cancelled) return;

        setPhase('listening');
        await startListening();
      } catch (e: any) {
        if (!cancelled) {
          setPhase('error');
          setErrorMsg(e.message ?? 'Session failed.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const handleMicPress = useCallback(async () => {
    if (isListening) {
      setPhase('thinking');
      const transcript = await stopListening();
      if (!transcript) {
        setPhase('listening');
        await startListening();
        return;
      }
      interrupt();
      setPhase('responding');
      const answer = await generateAvatarResponse(transcript, notesRef.current);
      await speakText(answer);
      setPhase('listening');
      await startListening();
    } else {
      await startListening();
      setPhase('listening');
    }
  }, [isListening, stopListening, startListening, interrupt, speakText]);

  const handleEnd = useCallback(() => {
    stopListening().catch(() => {});
    disconnect();
    router.back();
  }, [stopListening, disconnect]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Avatar video or loading state */}
      {videoTrack ? (
        <VideoView style={styles.video} videoTrack={videoTrack} />
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.placeholderText}>{PHASE_LABELS[phase]}</Text>
        </View>
      )}

      {/* Bottom HUD */}
      <View style={styles.hud}>
        <Text style={styles.statusLabel}>{PHASE_LABELS[phase]}</Text>

        {phase === 'error' && errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : null}

        <View style={styles.controls}>
          <Pressable
            onPress={handleMicPress}
            style={[styles.micBtn, isListening && styles.micBtnActive]}
            disabled={phase === 'loading' || phase === 'connecting' || phase === 'thinking'}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={scaleSize(28)}
              color="#fff"
            />
          </Pressable>

          <Pressable onPress={handleEnd} style={styles.endBtn}>
            <Text style={styles.endBtnText}>End Session</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleSize(16),
  },
  placeholderText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(16),
    color: '#aaa',
  },
  hud: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scaleSize(24),
    paddingVertical: scaleSize(24),
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    gap: scaleSize(12),
  },
  statusLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#ccc',
  },
  errorText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#ef4444',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleSize(24),
  },
  micBtn: {
    width: scaleSize(60),
    height: scaleSize(60),
    borderRadius: scaleSize(30),
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
  },
  endBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(12),
    paddingHorizontal: scaleSize(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  endBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(15),
    color: '#fff',
  },
});
