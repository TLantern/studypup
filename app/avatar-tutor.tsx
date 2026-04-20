import { getMaterials } from '@/lib/study-materials-storage';
import { generateIntroScript, generateSpokenNotes, generateAvatarResponse } from '@/lib/avatarScriptService';
import { elevenLabsPCMStream } from '@/lib/elevenlabs';
import { useLiveAvatarSession } from '@/lib/useLiveAvatarSession';
import { useAvatarSTT } from '@/lib/useAvatarSTT';
import { scaleFont, scaleSize } from '@/lib/responsive';
import { VideoView } from '@livekit/react-native';
import { Audio } from 'expo-av';
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

type Phase = 'loading' | 'connecting' | 'intro' | 'explaining' | 'listening' | 'thinking' | 'responding' | 'error';

export default function AvatarTutorScreen() {
  const insets = useSafeAreaInsets();
  const { materialId } = useLocalSearchParams<{ materialId?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [andrewWords, setAndrewWords] = useState<string[]>([]);
  const [andrewWordCount, setAndrewWordCount] = useState(0);
  const [userTranscript, setUserTranscript] = useState('');
  const notesRef = useRef<string>('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { sessionState, videoTrack, connect, streamAudioChunk, streamAudioEnd, interrupt, disconnect } =
    useLiveAvatarSession();
  const { isUserSpeaking, initAudio, startVAD, stopVAD, setAvatarSpeaking, kickCycle } = useAvatarSTT();

  const clearTypewriter = useCallback(() => {
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
    setAndrewWords([]);
    setAndrewWordCount(0);
  }, []);

  // Stored in ref so onSpeechStart always gets the latest version
  const clearTypewriterRef = useRef(clearTypewriter);
  clearTypewriterRef.current = clearTypewriter;

  const speak = useCallback(async (text: string) => {
    const words = text.split(/\s+/).filter(Boolean);
    const eventId = `speak_${Date.now()}`;

    // Suppress VAD auto-restart while Andrew speaks so mic doesn't pick up his voice
    setAvatarSpeaking(true);
    // Switch to speaker-output mode so LiveKit WebRTC audio plays through the speaker.
    // Without this, iOS routes audio to the earpiece while allowsRecordingIOS: true is active.
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, defaultToSpeaker: true });

    // Download audio — returns exact duration so typewriter matches speech
    const durationMs = await elevenLabsPCMStream(text, (chunk) => streamAudioChunk(chunk));

    // Avatar starts speaking now — kick off typewriter synced to audio duration
    setAndrewWords(words);
    setAndrewWordCount(1);
    if (words.length > 1) {
      const msPerWord = durationMs / words.length;
      let count = 1;
      typewriterRef.current = setInterval(() => {
        count++;
        setAndrewWordCount(count);
        if (count >= words.length) {
          clearInterval(typewriterRef.current!);
          typewriterRef.current = null;
        }
      }, msPerWord);
    }

    await streamAudioEnd(eventId, durationMs);
    clearTypewriter();

    // Andrew is done — allow VAD to restart and kick cycle if it died during his speech
    setAvatarSpeaking(false);
    await kickCycle();
  }, [streamAudioChunk, streamAudioEnd, clearTypewriter, setAvatarSpeaking, kickCycle]);

  // Stored in a ref so the VAD callback always has the latest version
  const handleTranscriptRef = useRef<(transcript: string) => Promise<void>>();
  handleTranscriptRef.current = async (transcript: string) => {
    await stopVAD();
    setUserTranscript(transcript);
    setPhase('thinking');
    const answer = await generateAvatarResponse(transcript, notesRef.current);
    setPhase('responding');
    await speak(answer); // speak() calls setAvatarSpeaking + kickCycle internally
    setUserTranscript('');
    setPhase('listening');
    // Restart VAD fresh for next turn
    await startVAD(
      () => { interrupt(); clearTypewriterRef.current(); },
      (t) => handleTranscriptRef.current?.(t),
    );
  };

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

        // Generate both in parallel during loading so there's no gap after the greeting
        const [greeting, spokenNotes] = await Promise.all([
          generateIntroScript(title),
          generateSpokenNotes(title, notesRef.current),
        ]);
        if (cancelled) return;

        setPhase('connecting');
        await initAudio();
        await connect();
        if (cancelled) return;

        // Start VAD now so user can interrupt at any point
        await startVAD(
          () => { interrupt(); clearTypewriterRef.current(); },
          (t) => handleTranscriptRef.current?.(t),
        );

        setPhase('intro');
        await speak(greeting);
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

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const handleEnd = useCallback(() => {
    stopVAD();
    disconnect();
    router.back();
  }, [stopVAD, disconnect]);

  const statusText =
    phase === 'loading' ? 'Preparing your session...' :
    phase === 'connecting' ? 'Connecting...' :
    phase === 'thinking' ? 'Thinking...' :
    isUserSpeaking ? 'Listening...' :
    '';

  return (
    <View style={styles.container}>
      {videoTrack ? (
        <VideoView style={styles.video} videoTrack={videoTrack} />
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.placeholderText}>{statusText}</Text>
        </View>
      )}

      <View style={styles.hud}>
        {/* Andrew's subtitles — typewritten in sync with audio */}
        {andrewWords.length > 0 ? (
          <View style={styles.subtitleBox}>
            <Text style={styles.speakerLabel}>Andrew</Text>
            <Text style={styles.subtitleText}>
              {andrewWords.slice(0, andrewWordCount).join(' ')}
            </Text>
          </View>
        ) : null}

        {/* User speaking / transcript */}
        {isUserSpeaking || userTranscript ? (
          <View style={styles.userBox}>
            <Text style={styles.userLabel}>You</Text>
            <Text style={styles.userText}>
              {isUserSpeaking && !userTranscript ? '...' : userTranscript}
            </Text>
          </View>
        ) : null}

        {phase === 'error' && errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : null}

        <Pressable onPress={handleEnd} style={styles.endBtn}>
          <Text style={styles.endBtnText}>End Session</Text>
        </Pressable>
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
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(12),
    color: '#a78bfa',
    marginBottom: 4,
  },
  subtitleText: {
    fontFamily: 'Fredoka_400Regular',
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
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(12),
    color: '#86efac',
    marginBottom: 2,
  },
  userText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#e5e7eb',
  },
  errorText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(14),
    color: '#ef4444',
    textAlign: 'center',
  },
  endBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: scaleSize(20),
    paddingVertical: scaleSize(12),
    paddingHorizontal: scaleSize(20),
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: scaleSize(4),
  },
  endBtnText: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: scaleFont(15),
    color: '#fff',
  },
});
