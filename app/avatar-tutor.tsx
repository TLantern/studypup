import { getMaterials } from '@/lib/study-materials-storage';
import { generateIntroScript, generateSpokenNotes, generateAvatarResponse } from '@/lib/avatarScriptService';
import { elevenLabsPCMStream } from '@/lib/elevenlabs';
import { transcribeAudio } from '@/lib/transcription';
import { useLiveAvatarSession } from '@/lib/useLiveAvatarSession';
import { GeneratingContentScreen } from '@/components/GeneratingContentScreen';
import { scaleFont, scaleSize } from '@/lib/responsive';
import { VideoView } from '@livekit/react-native';
import { Audio } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SF_PRO } from '@/lib/onboarding-theme';

type Phase = 'loading' | 'connecting' | 'intro' | 'explaining' | 'listening' | 'thinking' | 'responding' | 'error';

export default function AvatarTutorScreen() {
  const insets = useSafeAreaInsets();
  const { materialId } = useLocalSearchParams<{ materialId?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [andrewWords, setAndrewWords] = useState<string[]>([]);
  const [andrewWordCount, setAndrewWordCount] = useState(0);
  const [userTranscript, setUserTranscript] = useState('');
  const [isPressing, setIsPressing] = useState(false);
  const notesRef = useRef<string>('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // Incremented on every press-in so any in-flight handlePressOut flow detects it was superseded
  const pttGenRef = useRef(0);
  // Incremented on every speak() call so stale typewriter intervals self-cancel
  const speakVersionRef = useRef(0);

  const { sessionState, videoTrack, connect, streamAudioChunk, streamAudioEnd, interrupt, disconnect } =
    useLiveAvatarSession();

  const clearTypewriter = useCallback(() => {
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
    setAndrewWords([]);
    setAndrewWordCount(0);
  }, []);

  const speak = useCallback(async (text: string) => {
    speakVersionRef.current += 1;
    const myVersion = speakVersionRef.current;

    const words = text.split(/\s+/).filter(Boolean);
    const eventId = `speak_${Date.now()}`;

    // Switch to speaker-output mode so LiveKit WebRTC audio plays through the speaker.
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, defaultToSpeaker: true });

    const durationMs = await elevenLabsPCMStream(text, (chunk) => streamAudioChunk(chunk));
    if (speakVersionRef.current !== myVersion) return;

    setAndrewWords(words);
    setAndrewWordCount(1);
    if (words.length > 1) {
      const msPerWord = durationMs / words.length;
      let count = 1;
      typewriterRef.current = setInterval(() => {
        if (speakVersionRef.current !== myVersion) {
          clearInterval(typewriterRef.current!);
          typewriterRef.current = null;
          return;
        }
        count++;
        setAndrewWordCount(count);
        if (count >= words.length) {
          clearInterval(typewriterRef.current!);
          typewriterRef.current = null;
        }
      }, msPerWord);
    }

    await streamAudioEnd(eventId, durationMs);
    if (speakVersionRef.current === myVersion) clearTypewriter();
  }, [streamAudioChunk, streamAudioEnd, clearTypewriter]);

  const handlePressIn = useCallback(async () => {
    // Cancel any in-flight response flow
    pttGenRef.current += 1;
    interrupt();
    clearTypewriter();
    setPhase('listening');

    try {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, defaultToSpeaker: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsPressing(true);
    } catch (e) {
      console.error('[PTT] Failed to start recording:', e);
    }
  }, [interrupt, clearTypewriter]);

  const handlePressOut = useCallback(async () => {
    if (!isPressing) return;
    setIsPressing(false);

    const gen = pttGenRef.current;
    const recording = recordingRef.current;
    recordingRef.current = null;

    try {
      await recording?.stopAndUnloadAsync();
      const uri = recording?.getURI();
      if (!uri || pttGenRef.current !== gen) return;

      setPhase('thinking');
      let transcript = '';
      try { transcript = await transcribeAudio(uri); } catch {}
      if (pttGenRef.current !== gen) return;

      if (!transcript.trim()) {
        setPhase('listening');
        return;
      }

      setUserTranscript(transcript);
      const answer = await generateAvatarResponse(transcript, notesRef.current);
      if (pttGenRef.current !== gen) return;

      setPhase('responding');
      await speak(answer);
      if (pttGenRef.current !== gen) return;

      setUserTranscript('');
      setPhase('listening');
    } catch (e: any) {
      console.error('[PTT] Error:', e);
      if (pttGenRef.current === gen) setPhase('listening');
    }
  }, [isPressing, speak]);

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

        notesRef.current = material.notes ?? '';
        const title = material.title ?? 'this topic';

        const [greeting, spokenNotes] = await Promise.all([
          generateIntroScript(title),
          generateSpokenNotes(title, notesRef.current),
        ]);
        if (cancelled) return;

        setPhase('connecting');
        await Audio.requestPermissionsAsync();
        await connect();
        if (cancelled) return;

        setPhase('intro');
        await speak(greeting);
        if (cancelled) return;

        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;

        setPhase('explaining');
        await speak(spokenNotes);
        if (cancelled) return;

        setPhase('listening');
      } catch (e: any) {
        if (!cancelled) {
          console.error('[AvatarTutor] Session error:', e.message, e);
          setPhase('error');
          setErrorMsg(e.message ?? 'Session failed.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [materialId]);

  const handleEnd = useCallback(() => {
    try { recordingRef.current?.stopAndUnloadAsync(); } catch {}
    recordingRef.current = null;
    disconnect();
    router.back();
  }, [disconnect]);

  const canTalk = phase !== 'loading' && phase !== 'connecting' && phase !== 'error';

  const statusText =
    phase === 'loading' ? 'Preparing your session...' :
    phase === 'connecting' ? 'Connecting...' :
    phase === 'thinking' ? 'Thinking...' :
    isPressing ? 'Listening...' :
    '';

  if (phase === 'loading' || phase === 'connecting') {
    return (
      <View style={styles.loaderWrap}>
        <GeneratingContentScreen contentTypes={[]} isAvatarTutor />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {videoTrack ? (
        <VideoView style={styles.video} videoTrack={videoTrack} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{statusText}</Text>
        </View>
      )}

      <View style={styles.hud}>
        {andrewWords.length > 0 ? (
          <View style={styles.subtitleBox}>
            <Text style={styles.speakerLabel}>Andrew</Text>
            <Text style={styles.subtitleText}>
              {andrewWords.slice(0, andrewWordCount).join(' ')}
            </Text>
          </View>
        ) : null}

        {isPressing || userTranscript ? (
          <View style={styles.userBox}>
            <Text style={styles.userLabel}>You</Text>
            <Text style={styles.userText}>
              {isPressing && !userTranscript ? '...' : userTranscript}
            </Text>
          </View>
        ) : null}

        {phase === 'error' && errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : null}

        <View style={styles.controls}>
          <Pressable
            onPressIn={canTalk ? handlePressIn : undefined}
            onPressOut={canTalk ? handlePressOut : undefined}
            style={[styles.pttBtn, isPressing && styles.pttBtnActive, !canTalk && styles.pttBtnDisabled]}
          >
            <Text style={styles.pttEmoji}>✋</Text>
            <Text style={styles.pttLabel}>{isPressing ? 'Release to send' : 'Hold to talk'}</Text>
          </Pressable>

          <Pressable onPress={handleEnd} style={styles.endBtn}>
            <Text style={styles.endBtnText}>End</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrap: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(16),
    color: '#aaa',
  },
  hud: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(20),
    gap: scaleSize(10),
    alignItems: 'stretch',
  },
  subtitleBox: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: scaleSize(12),
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(12),
  },
  speakerLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: '#a78bfa',
    marginBottom: 4,
  },
  subtitleText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: '#fff',
    lineHeight: scaleFont(22),
  },
  userBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scaleSize(12),
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(10),
  },
  userLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(12),
    color: '#86efac',
    marginBottom: 2,
  },
  userText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: '#e5e7eb',
  },
  errorText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(14),
    color: '#ef4444',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleSize(12),
    marginTop: scaleSize(4),
  },
  pttBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(20),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scaleSize(8),
  },
  pttBtnActive: {
    backgroundColor: '#e0e7ff',
    transform: [{ scale: 0.97 }],
  },
  pttBtnDisabled: {
    opacity: 0.4,
  },
  pttEmoji: {
    fontSize: scaleFont(20),
  },
  pttLabel: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: '#111',
  },
  endBtn: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(14),
    paddingHorizontal: scaleSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  endBtnText: {
    fontFamily: SF_PRO,
    fontSize: scaleFont(15),
    color: '#111',
    fontWeight: '600',
  },
});
