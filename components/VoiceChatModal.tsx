import { callOpenAIChat, isOpenAIConfigured } from '@/lib/openai-service';
import { transcribeAudio } from '@/lib/transcription';
import { speakWithElevenLabs, stopElevenLabsAudio, isElevenLabsConfigured } from '@/lib/elevenlabs';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PURPLE = '#7c3aed';

// VAD config
const SPEECH_THRESHOLD = -35;   // dB — above = speech detected
const SILENCE_DURATION = 1500;  // ms of silence before we stop recording
const MIN_SPEECH_MS = 400;      // ignore blips shorter than this
// Barge-in config (stricter than VAD to avoid AI audio bleed-through)
const BARGE_IN_THRESHOLD = -20; // louder threshold — only loud user speech
const BARGE_IN_FRAMES = 5;      // consecutive 100ms frames required (~500ms of sustained speech)

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
type Message = { role: 'user' | 'assistant'; content: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  context: string;
}

const SYSTEM_PROMPT = `You are StudyPup, a friendly voice study assistant. Keep ALL responses to 2-3 short sentences max unless the user asks for more. Be warm and conversational.\n\nStudent notes:\n`;

const INTRO = "Hey! How can I help you understand your notes today?";

const THINKING_FILLERS = [
  "Hmm, let me think about that…",
  "Good question, give me one sec…",
  "Let me check your notes real quick…",
  "Okay, thinking hard about this…",
  "Ooh, interesting — working it out…",
  "Let me see… I've got some thoughts on this…",
];

export function VoiceChatModal({ visible, onClose, context }: Props) {
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const monitorRef = useRef<Audio.Recording | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartedRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const listeningRef = useRef(false);
  const pendingReplyRef = useRef<string | null>(null);
  const fillerActiveRef = useRef(false);
  const speakFillerRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('idle');
  const [history, setHistory] = useState<Message[]>([]);
  const historyRef = useRef<Message[]>([]);

  // Keep historyRef in sync
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    if (!visible) {
      cleanup();
      setPhase('idle');
      setHistory([]);
      historyRef.current = [];
    }
  }, [visible]);

  const stopBargeInMonitor = async () => {
    const rec = monitorRef.current;
    if (!rec) return;
    monitorRef.current = null;
    try { await rec.stopAndUnloadAsync(); } catch {}
  };

  const cleanup = useCallback(() => {
    listeningRef.current = false;
    pendingReplyRef.current = null;
    fillerActiveRef.current = false;
    stopRecording(false);
    stopBargeInMonitor();
    stopElevenLabsAudio();
    Speech.stop();
    lottieRef.current?.pause();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  const playAnim = () => lottieRef.current?.play();
  const pauseAnim = () => lottieRef.current?.pause();

  // Speak via ElevenLabs (fallback to expo-speech) with barge-in support
  const speak = useCallback((text: string, onDone?: () => void) => {
    setPhase('speaking');
    playAnim();

    const done = () => {
      stopBargeInMonitor();
      pauseAnim();
      setPhase('idle');
      onDone?.();
      if (listeningRef.current) startVAD();
    };

    if (isElevenLabsConfigured()) {
      speakWithElevenLabs(text, done, () => done());
    } else {
      Speech.stop();
      Speech.speak(text, { rate: 0.95, onDone: done, onStopped: done });
    }

    // Start barge-in monitor after delay to let AI audio route through speaker first
    setTimeout(() => startBargeInMonitor(), 1000);
  }, []);

  // Speak a filler phrase while waiting for API; loops until pendingReplyRef is set
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
        speakFillerRef.current(); // still waiting — say another
      }
    };
    if (isElevenLabsConfigured()) {
      speakWithElevenLabs(text, onDone, onDone);
    } else {
      Speech.stop();
      Speech.speak(text, { rate: 0.95, onDone, onStopped: onDone });
    }
  };

  // Interrupt AI and start listening immediately
  const handleBargeIn = useCallback(async () => {
    pendingReplyRef.current = null;
    fillerActiveRef.current = false;
    stopElevenLabsAudio();
    Speech.stop();
    await stopBargeInMonitor();
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (listeningRef.current) {
      setPhase('listening');
      pauseAnim();
      startVAD();
    }
  }, []);

  // Monitor mic during AI speech — triggers barge-in if user speaks
  const startBargeInMonitor = useCallback(async () => {
    if (monitorRef.current) return; // already running
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      monitorRef.current = recording;
      let consecutiveFrames = 0;
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording || !listeningRef.current || !monitorRef.current) return;
        if ((status.metering ?? -160) > BARGE_IN_THRESHOLD) {
          consecutiveFrames++;
          if (consecutiveFrames >= BARGE_IN_FRAMES) handleBargeIn();
        } else {
          consecutiveFrames = 0;
        }
      });
      recording.setProgressUpdateInterval(100);
    } catch {}
  }, [handleBargeIn]);

  // Stop current recording (optionally process it)
  const stopRecording = async (process = true) => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      if (!process) return;
      const uri = rec.getURI();
      if (!uri) return;
      await processAudio(uri);
    } catch {}
  };

  const processAudio = async (uri: string) => {
    setPhase('thinking');
    pendingReplyRef.current = null;
    fillerActiveRef.current = false;
    pauseAnim();
    try {
      let userText = '';
      if (isOpenAIConfigured()) {
        userText = await transcribeAudio(uri);
      }
      if (!userText.trim()) {
        setPhase('idle');
        if (listeningRef.current) startVAD();
        return;
      }

      const newHistory: Message[] = [...historyRef.current, { role: 'user', content: userText }];
      historyRef.current = newHistory;
      setHistory(newHistory);

      // Speak a filler while the API call runs
      speakFillerRef.current();

      const aiReply = isOpenAIConfigured()
        ? await callOpenAIChat([
            { role: 'system', content: SYSTEM_PROMPT + context },
            ...newHistory,
          ])
        : "I'd love to help — connect an OpenAI key to enable responses.";

      const finalHistory: Message[] = [...newHistory, { role: 'assistant', content: aiReply }];
      historyRef.current = finalHistory;
      setHistory(finalHistory);

      if (fillerActiveRef.current) {
        // Filler still speaking — queue reply to play right after it finishes
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
      if (listeningRef.current) startVAD();
    }
  };

  // Start VAD recording loop
  const startVAD = useCallback(async () => {
    if (!listeningRef.current) return;
    await stopBargeInMonitor(); // ensure monitor is released before opening a new recording
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      speechStartedRef.current = false;
      speechStartTimeRef.current = 0;
      setPhase('listening');

      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording || !listeningRef.current) return;
        const db = status.metering ?? -160;
        const isSpeech = db > SPEECH_THRESHOLD;

        if (isSpeech) {
          if (!speechStartedRef.current) {
            speechStartedRef.current = true;
            speechStartTimeRef.current = Date.now();
          }
          // Cancel any silence timer
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        } else if (speechStartedRef.current) {
          // Start silence timer if not already running
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(async () => {
              silenceTimerRef.current = null;
              const spokenMs = Date.now() - speechStartTimeRef.current;
              if (spokenMs >= MIN_SPEECH_MS) {
                await stopRecording(true);
              } else {
                await stopRecording(false);
                if (listeningRef.current) startVAD();
              }
            }, SILENCE_DURATION);
          }
        }
      });
      recording.setProgressUpdateInterval(100);
    } catch (e) {
      console.error('[VAD start]', e);
    }
  }, [context]);

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
        {/* Close */}
        <Pressable style={[styles.closeBtn, { top: insets.top + 14 }]} onPress={() => { cleanup(); onClose(); }} hitSlop={12}>
          <Ionicons name="close" size={26} color="#555" />
        </Pressable>

        {/* Animation */}
        <View style={styles.animWrap}>
          <LottieView
            ref={lottieRef}
            source={require('../AI logo Foriday.json')}
            style={styles.lottie}
            autoPlay={false}
            loop
          />
        </View>

        {/* CTA */}
        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + 24 }]}>
          {phase === 'idle' && history.length === 0 ? (
            <Pressable style={styles.startBtn} onPress={handleStart}>
              <Text style={styles.startBtnText}>Start</Text>
            </Pressable>
          ) : (
            <Text style={styles.phaseLabel}>
              {phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'Thinking…' : phase === 'speaking' ? 'Speaking…' : ''}
            </Text>
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
  startBtnText: { fontFamily: 'FredokaOne_400Regular', fontSize: 17, color: PURPLE },
  phaseLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#666' },
});
