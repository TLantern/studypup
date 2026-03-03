import { callOpenAIChat } from '@/lib/openai-service';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const TEAL = '#5BBCBC';
const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const EL_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const EL_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const EL_MODEL = 'eleven_flash_v2_5';

const FILLERS = [
  "Hmm... that's a good question",
  "Let me consult my notes... and my feelings",
  "Please hold, your call is important to us",
  "Thinking really hard right now...",
  "Almost got it, just untangling some brain cells",
];

const SYSTEM_PROMPT = `You are "Pup", a witty study buddy. You explain things clearly but can't resist throwing in a funny analogy or a dry joke. Keep it helpful and short (2-3 sentences). No markdown, no asterisks.`;

type Phase = 'idle' | 'listening' | 'processing' | 'speaking';

type Props = {
  visible: boolean;
  onClose: () => void;
  context: string;
};

export function VoiceChatModal({ visible, onClose, context }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [fillerIdx, setFillerIdx] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadRecRef = useRef<Audio.Recording | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsSoundRef = useRef<Audio.Sound | null>(null);
  const aiReplyRef = useRef<string | null>(null);
  const fillerIdxRef = useRef(0);
  const cancelledRef = useRef(false);
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (!visible) {
      cancelledRef.current = true;
      cleanup();
      setPhase('idle');
      setTranscript('');
      setAiReply('');
      fillerIdxRef.current = 0;
      setFillerIdx(0);
    } else {
      cancelledRef.current = false;
      // Use PlayAndRecord throughout so mic + speaker coexist (like a phone call)
      Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true }).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (phase === 'listening') startPulse(); else stopPulse();
    if (phase === 'speaking') { startBars(); startVADMonitor(); }
    else { stopBars(); stopVADMonitor(); }
  }, [phase]);

  // --- VAD during AI speech ---
  async function startVADMonitor() {
    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.LOW_QUALITY,
        isMeteringEnabled: true,
      });
      await rec.startAsync();
      vadRecRef.current = rec;

      const VOICE_THRESHOLD_DB = -30;
      vadIntervalRef.current = setInterval(async () => {
        if (cancelledRef.current) { stopVADMonitor(); return; }
        try {
          const status = await rec.getStatusAsync();
          const db = (status as any).metering ?? -100;
          if (db > VOICE_THRESHOLD_DB) {
            await interrupt();
          }
        } catch { stopVADMonitor(); }
      }, 150);
    } catch (e) {
      console.error('VAD monitor error', e);
    }
  }

  async function stopVADMonitor() {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (vadRecRef.current) {
      const rec = vadRecRef.current;
      vadRecRef.current = null;
      await rec.stopAndUnloadAsync().catch(() => {});
    }
  }

  function startPulse() {
    const make = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    make(pulse1, 0);
    make(pulse2, 300);
    make(pulse3, 600);
  }

  function stopPulse() {
    [pulse1, pulse2, pulse3].forEach((p) => { p.stopAnimation(); p.setValue(1); });
  }

  function startBars() {
    bars.forEach((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(b, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.2, duration: 350, useNativeDriver: true }),
        ])
      ).start()
    );
  }

  function stopBars() {
    bars.forEach((b) => { b.stopAnimation(); b.setValue(0.3); });
  }

  // --- ElevenLabs TTS ---
  async function speakWithEL(text: string, onDone: () => void) {
    if (cancelledRef.current) return;
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}`, {
        method: 'POST',
        headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: EL_MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);

      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: 'base64' as any,
      });

      if (cancelledRef.current) { FileSystem.deleteAsync(fileUri, { idempotent: true }); return; }

      const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
      ttsSoundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          ttsSoundRef.current = null;
          if (!cancelledRef.current) onDone();
        }
      });
    } catch (e: any) {
      console.error('speakWithEL error', e);
      // Fallback to device TTS if ElevenLabs fails (quota, network, etc.)
      if (!cancelledRef.current) {
        Speech.speak(text, { onDone: onDone, onError: onDone });
      }
    }
  }

  // --- Recording ---
  async function startListening() {
    if (cancelledRef.current) return;
    try {
      // Unload any leftover recording before creating a new one
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await rec.startAsync();
      recordingRef.current = rec;
      setPhase('listening');
      startSilenceDetection(rec);
    } catch (e) {
      console.error('startListening error', e);
    }
  }

  function startSilenceDetection(rec: Audio.Recording) {
    let silentMs = 0;
    const INTERVAL = 200;
    const THRESHOLD_DB = -40;
    const SILENCE_MS = 3000;

    meteringIntervalRef.current = setInterval(async () => {
      if (cancelledRef.current) { clearInterval(meteringIntervalRef.current!); return; }
      try {
        const status = await rec.getStatusAsync();
        if (!status.isRecording) return;
        const db = (status as any).metering ?? 0;
        if (db < THRESHOLD_DB) {
          silentMs += INTERVAL;
          if (silentMs >= SILENCE_MS) {
            clearInterval(meteringIntervalRef.current!);
            meteringIntervalRef.current = null;
            await finishRecording();
          }
        } else {
          silentMs = 0;
        }
      } catch {
        clearInterval(meteringIntervalRef.current!);
      }
    }, INTERVAL);
  }

  async function finishRecording() {
    const rec = recordingRef.current;
    if (!rec || cancelledRef.current) return;
    recordingRef.current = null;
    setPhase('processing');
    aiReplyRef.current = null;
    fillerIdxRef.current = 0;
    setFillerIdx(0);

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) throw new Error('No recording URI');

      speakNextFiller();

      const userText = (await transcribeAudio(uri)).trim();
      if (cancelledRef.current) return;

      setTranscript(userText);
      historyRef.current = [...historyRef.current, { role: 'user', content: userText }];

      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: SYSTEM_PROMPT + '\n\nStudent notes context:\n' + context },
        ...historyRef.current,
      ];
      const reply = await callOpenAIChat(messages, { maxTokens: 200 });
      if (cancelledRef.current) return;

      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
      aiReplyRef.current = reply;
      setAiReply(reply);
    } catch (e) {
      console.error('finishRecording error', e);
      if (!cancelledRef.current) {
        aiReplyRef.current = "I ran into a little brain freeze there. Could you try again?";
        setAiReply(aiReplyRef.current);
      }
    }
  }

  function speakNextFiller() {
    if (cancelledRef.current) return;
    const idx = fillerIdxRef.current;
    // Stop cycling if we've exhausted all fillers — just wait silently
    if (idx >= FILLERS.length) return;
    const phrase = FILLERS[idx];
    speakWithEL(phrase, () => {
      if (cancelledRef.current) return;
      if (aiReplyRef.current !== null) {
        playReply(aiReplyRef.current);
      } else {
        fillerIdxRef.current += 1;
        setFillerIdx(fillerIdxRef.current);
        speakNextFiller();
      }
    });
  }

  function playReply(reply: string) {
    if (cancelledRef.current) return;
    setPhase('speaking');
    speakWithEL(reply, () => {
      if (cancelledRef.current) return;
      setPhase('listening');
      startListening();
    });
  }

  async function interrupt() {
    if (phase !== 'speaking') return;
    if (ttsSoundRef.current) {
      ttsSoundRef.current.stopAsync().catch(() => {});
      ttsSoundRef.current.unloadAsync().catch(() => {});
      ttsSoundRef.current = null;
    }
    Speech.stop();
    await stopVADMonitor(); // wait for VAD recording to fully unload first
    setPhase('listening');
    startListening();
  }

  async function transcribeAudio(uri: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
    formData.append('model', 'whisper-1');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: formData,
    });
    const json = await res.json();
    return json.text ?? '';
  }

  function cleanup() {
    stopVADMonitor();
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    if (ttsSoundRef.current) {
      ttsSoundRef.current.stopAsync().catch(() => {});
      ttsSoundRef.current.unloadAsync().catch(() => {});
      ttsSoundRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    aiReplyRef.current = null;
  }

  function handleClose() {
    cancelledRef.current = true;
    cleanup();
    historyRef.current = [];
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Voice Chat</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#555" />
            </Pressable>
          </View>

          <Text style={styles.statusLabel}>
            {phase === 'idle' && 'Tap the mic to start talking'}
            {phase === 'listening' && 'Listening...'}
            {phase === 'processing' && FILLERS[fillerIdx % FILLERS.length]}
            {phase === 'speaking' && 'Pup is speaking... tap to jump in'}
          </Text>

          <View style={styles.visualCenter}>
            {(phase === 'idle' || phase === 'listening') && (
              <Pressable
                onPress={() => { if (phase === 'idle') startListening(); }}
                style={styles.micOuter}
              >
                {phase === 'listening' && (
                  <>
                    <Animated.View style={[styles.ring, styles.ring3, { transform: [{ scale: pulse3 }] }]} />
                    <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: pulse2 }] }]} />
                    <Animated.View style={[styles.ring, styles.ring1, { transform: [{ scale: pulse1 }] }]} />
                  </>
                )}
                <View style={[styles.micCircle, phase === 'listening' && styles.micCircleActive]}>
                  <Ionicons name="mic" size={36} color="#fff" />
                </View>
              </Pressable>
            )}

            {phase === 'processing' && (
              <View style={styles.pupCircle}>
                <Text style={styles.pupEmoji}>🐾</Text>
              </View>
            )}

            {phase === 'speaking' && (
              <Pressable style={styles.speakingWrap} onPress={interrupt}>
                <View style={styles.pupCircle}>
                  <Text style={styles.pupEmoji}>🐾</Text>
                </View>
                <View style={styles.barsRow}>
                  {bars.map((b, i) => (
                    <Animated.View
                      key={i}
                      style={[styles.bar, { transform: [{ scaleY: b }] }]}
                    />
                  ))}
                </View>
                <Text style={styles.interruptHint}>tap to interrupt</Text>
              </Pressable>
            )}
          </View>

          {transcript !== '' && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>You said</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          )}
          {aiReply !== '' && (
            <View style={styles.replyBox}>
              <Text style={styles.replyLabel}>Pup</Text>
              <Text style={styles.replyText}>{aiReply}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontFamily: 'Fredoka_400Regular', fontSize: 20, color: '#333' },
  closeBtn: { padding: 4 },
  statusLabel: {
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    color: '#777',
    marginBottom: 28,
    textAlign: 'center',
    minHeight: 22,
  },
  visualCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    width: '100%',
    marginBottom: 20,
  },
  micOuter: { alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  ring: { position: 'absolute', borderRadius: 100, borderWidth: 2, borderColor: TEAL },
  ring1: { width: 90, height: 90, opacity: 0.6 },
  ring2: { width: 115, height: 115, opacity: 0.35 },
  ring3: { width: 140, height: 140, opacity: 0.15 },
  micCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micCircleActive: { backgroundColor: TEAL },
  speakingWrap: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  pupCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pupEmoji: { fontSize: 36 },
  barsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 },
  interruptHint: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#aaa', marginTop: 4 },
  bar: { width: 8, height: 32, borderRadius: 4, backgroundColor: TEAL },
  transcriptBox: {
    width: '100%',
    backgroundColor: '#F2E4E4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  transcriptLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 11, color: '#999', marginBottom: 4 },
  transcriptText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#444' },
  replyBox: {
    width: '100%',
    backgroundColor: '#E8F7F7',
    borderRadius: 12,
    padding: 12,
  },
  replyLabel: { fontFamily: 'Fredoka_400Regular', fontSize: 11, color: '#999', marginBottom: 4 },
  replyText: { fontFamily: 'Fredoka_400Regular', fontSize: 14, color: '#333' },
});
