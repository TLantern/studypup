import { callOpenAIChat, isOpenAIConfigured } from '@/lib/openai-service';
import { transcribeAudio } from '@/lib/transcription';
import { speakWithElevenLabs, stopElevenLabsAudio, isElevenLabsConfigured } from '@/lib/elevenlabs';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SF_PRO } from '@/lib/onboarding-theme';

const PURPLE = '#7FA8FF';

const SPEECH_THRESHOLD = -25;   // dB — above = speech detected
const SILENCE_DURATION = 1500;  // ms of silence before stopping
const MIN_SPEECH_MS = 400;      // ignore blips shorter than this
const BARGE_IN_THRESHOLD = -20; // dB — louder threshold for barge-in
const BARGE_IN_FRAMES = 5;      // consecutive 100ms frames required

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
type RecMode = 'vad' | 'barge-in';
type Message = { role: 'user' | 'assistant'; content: string };

interface Props { visible: boolean; onClose: () => void; context: string; }

const SYSTEM_PROMPT = `You are a charming, confident tutor with a natural tutor-student dynamic. Keep ALL responses to 2-3 short sentences max unless asked for more. Occasionally slip in a subtle compliment or playful remark — smooth, never over the top.\n\nStudent notes:\n`;
const INTRO = "My name's Andrew — but you can call me Drew. Good taste picking this to study. Let's get straight into it — what do you want to go over first?";
const THINKING_FILLERS = [
  "Hmm, let me think about that for a second — there's a lot to unpack here.",
  "Good question! Give me just a moment while I work through this carefully.",
  "Let me check your notes real quick and put together a solid answer for you.",
  "Okay, I'm thinking hard about this one — I want to make sure I get it right.",
  "Ooh, interesting question — let me work through all the details before I answer.",
  "Let me see… I've got some thoughts on this, just give me one moment to organise them.",
  "That's a great one — I'm pulling everything together from your notes right now.",
  "Just a sec — I want to give you the most helpful answer I can on this.",
];

export function VoiceChatModal({ visible, onClose, context }: Props) {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);

  // Single recording — mode determines VAD vs barge-in behavior
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recModeRef = useRef<RecMode | null>(null);
  const recBusyRef = useRef(false);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartedRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const listeningRef = useRef(false);
  const pendingReplyRef = useRef<string | null>(null);
  const fillerActiveRef = useRef(false);

  // Stable function refs to avoid stale closures in callbacks
  const speakFillerRef = useRef<() => void>(() => {});
  const startVADRef = useRef<() => Promise<void>>(async () => {});
  const handleBargeInRef = useRef<() => Promise<void>>(async () => {});

  const [phase, setPhase] = useState<Phase>('idle');
  const [history, setHistory] = useState<Message[]>([]);
  const historyRef = useRef<Message[]>([]);

  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    if (!visible) {
      cleanup();
      setPhase('idle');
      setHistory([]);
      historyRef.current = [];
    }
  }, [visible]);

  const playAnim = () => lottieRef.current?.play();
  const pauseAnim = () => lottieRef.current?.pause();

  // Stop and release the current recording
  const stopCurrentRecording = async () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    recModeRef.current = null;
    try { await rec.stopAndUnloadAsync(); } catch {}
  };

  // Start a single recording in the given mode
  const startRecording = async (mode: RecMode) => {
    if (recBusyRef.current) return;
    recBusyRef.current = true;
    try {
      await stopCurrentRecording();
      if (!listeningRef.current) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        defaultToSpeaker: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      recModeRef.current = mode;

      if (mode === 'vad') {
        speechStartedRef.current = false;
        speechStartTimeRef.current = 0;
        setPhase('listening');

        recording.setOnRecordingStatusUpdate((status) => {
          if (!status.isRecording || !listeningRef.current || recModeRef.current !== 'vad') return;
          const db = status.metering ?? -160;

          if (db > SPEECH_THRESHOLD) {
            if (!speechStartedRef.current) {
              speechStartedRef.current = true;
              speechStartTimeRef.current = Date.now();
            }
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          } else if (speechStartedRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(async () => {
              silenceTimerRef.current = null;
              const spokenMs = Date.now() - speechStartTimeRef.current;
              const rec = recordingRef.current;
              recordingRef.current = null;
              recModeRef.current = null;
              if (!rec) return;
              try {
                await rec.stopAndUnloadAsync();
                if (spokenMs >= MIN_SPEECH_MS) {
                  const uri = rec.getURI();
                  if (uri) await processAudio(uri);
                  else if (listeningRef.current) startVADRef.current();
                } else {
                  if (listeningRef.current) startVADRef.current();
                }
              } catch {
                if (listeningRef.current) startVADRef.current();
              }
            }, SILENCE_DURATION);
          }
        });
      } else {
        // barge-in mode: mic is open but interrupt is button-only, no speech detection
      }
      recording.setProgressUpdateInterval(100);
    } catch (e) {
      console.error('[Recording start]', e);
    } finally {
      recBusyRef.current = false;
    }
  };

  // Keep startVADRef stable and up-to-date
  startVADRef.current = () => startRecording('vad');

  const speak = (text: string, onDone?: () => void) => {
    setPhase('speaking');
    playAnim();

    const done = () => {
      pauseAnim();
      setPhase('idle');
      onDone?.();
      // Stop barge-in monitor (if still running) then go to VAD
      stopCurrentRecording().then(() => {
        if (listeningRef.current) startRecording('vad');
      });
    };

    // Stop VAD/barge-in before speaking, then start barge-in monitor after 1s
    stopCurrentRecording().then(() => {
      if (isElevenLabsConfigured()) {
        speakWithElevenLabs(text, done, () => done());
      } else {
        Speech.stop();
        Speech.speak(text, { rate: 0.95, onDone: done, onStopped: done });
      }
      setTimeout(() => {
        if (listeningRef.current && recModeRef.current === null) startRecording('barge-in');
      }, 1000);
    });
  };

  speakFillerRef.current = () => {
    if (!listeningRef.current) return;
    const text = THINKING_FILLERS[Math.floor(Math.random() * THINKING_FILLERS.length)];
    fillerActiveRef.current = true;
    playAnim();
    const onDone = () => {
      fillerActiveRef.current = false;
      if (!listeningRef.current) return;
      if (pendingReplyRef.current !== null) {
        const reply = pendingReplyRef.current;
        pendingReplyRef.current = null;
        speak(reply);
      } else {
        speakFillerRef.current();
      }
    };
    if (isElevenLabsConfigured()) {
      speakWithElevenLabs(text, onDone, onDone);
    } else {
      Speech.stop();
      Speech.speak(text, { rate: 0.95, onDone, onStopped: onDone });
    }
  };

  handleBargeInRef.current = async () => {
    pendingReplyRef.current = null;
    fillerActiveRef.current = false;
    stopElevenLabsAudio();
    Speech.stop();
    await stopCurrentRecording();
    if (listeningRef.current) {
      setPhase('listening');
      pauseAnim();
      await startRecording('vad');
    }
  };

  const processAudio = async (uri: string) => {
    setPhase('thinking');
    pendingReplyRef.current = null;
    fillerActiveRef.current = false;
    pauseAnim();
    try {
      const userText = isOpenAIConfigured() ? await transcribeAudio(uri) : '';
      if (!userText.trim()) {
        setPhase('idle');
        if (listeningRef.current) startRecording('vad');
        return;
      }

      const newHistory: Message[] = [...historyRef.current, { role: 'user', content: userText }];
      historyRef.current = newHistory;
      setHistory(newHistory);

      speakFillerRef.current();

      const aiReply = isOpenAIConfigured()
        ? await callOpenAIChat([{ role: 'system', content: SYSTEM_PROMPT + context }, ...newHistory])
        : "I'd love to help — connect an OpenAI key to enable responses.";

      const finalHistory: Message[] = [...newHistory, { role: 'assistant', content: aiReply }];
      historyRef.current = finalHistory;
      setHistory(finalHistory);

      if (fillerActiveRef.current) {
        pendingReplyRef.current = aiReply;
      } else {
        speak(aiReply);
      }
    } catch (e) {
      console.error('[VoiceChat]', e);
      stopElevenLabsAudio();
      Speech.stop();
      pendingReplyRef.current = null;
      fillerActiveRef.current = false;
      setPhase('idle');
      if (listeningRef.current) startRecording('vad');
    }
  };

  const cleanup = () => {
    listeningRef.current = false;
    pendingReplyRef.current = null;
    fillerActiveRef.current = false;
    recBusyRef.current = false;
    stopCurrentRecording();
    stopElevenLabsAudio();
    Speech.stop();
    lottieRef.current?.pause();
  };

  const handleStart = async () => {
    const ok = await Audio.requestPermissionsAsync();
    if (ok.status !== 'granted') return;
    listeningRef.current = true;
    speak(INTRO, () => {
      const intro: Message[] = [{ role: 'assistant', content: INTRO }];
      historyRef.current = intro;
      setHistory(intro);
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { cleanup(); onClose(); }}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <Pressable style={[styles.closeBtn, { top: insets.top + 14 }]} onPress={() => { cleanup(); onClose(); }} hitSlop={12}>
          <Ionicons name="close" size={26} color="#555" />
        </Pressable>
        <View style={styles.animWrap}>
          <LottieView
            ref={lottieRef}
            source={require('../AI logo Foriday.json')}
            style={styles.lottie}
            autoPlay={false}
            loop
          />
        </View>
        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 24 }]}>
          {phase === 'idle' && history.length === 0 ? (
            <Pressable style={styles.startBtn} onPress={handleStart}>
              <Text style={styles.startBtnText}>Start</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.phaseLabel}>
                {phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Thinking…' : phase === 'speaking' ? 'Speaking…' : ''}
              </Text>
              {phase === 'speaking' && (
                <Pressable style={styles.interruptBtn} onPress={() => handleBargeInRef.current()}>
                  <Ionicons name="mic" size={20} color={PURPLE} />
                  <Text style={styles.interruptBtnText}>Interrupt</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'space-between', paddingTop: 80, paddingHorizontal: 28 },
  closeBtn: { position: 'absolute', left: 20, zIndex: 10, padding: 4 },
  animWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lottie: { width: 240, height: 240 },
  ctaWrap: { alignItems: 'center', width: '100%' },
  startBtn: { backgroundColor: '#ede9fe', borderRadius: 24, paddingVertical: 11, paddingHorizontal: 36 },
  startBtnText: { fontFamily: SF_PRO, fontSize: 17, color: PURPLE },
  phaseLabel: { fontFamily: SF_PRO, fontSize: 16, color: '#666', marginBottom: 14 },
  interruptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ede9fe', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 24 },
  interruptBtnText: { fontFamily: SF_PRO, fontSize: 16, color: PURPLE },
});
