import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

const SPEECH_DB = -15;       // dB level to count as speech
const SILENCE_MS = 1400;     // ms of quiet before cutting the clip
const MIN_SPEECH_MS = 600;   // ignore clips shorter than this
const MIN_FILE_BYTES = 5000; // ignore near-silent recordings

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

async function transcribeAudio(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return '';
    if ('size' in info && typeof info.size === 'number' && info.size < MIN_FILE_BYTES) return '';

    const form = new FormData();
    form.append('file', { uri, type: 'audio/m4a', name: 'audio.m4a' } as any);
    form.append('model', 'gpt-4o-transcribe');
    // Prompt guides Whisper to expect a student question, not tutor content
    form.append('prompt', 'Student asking a question to their tutor:');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) return '';
    return ((await res.json()).text ?? '').trim();
  } catch {
    return '';
  }
}

export type UseAvatarSTTResult = {
  isUserSpeaking: boolean;
  initAudio: () => Promise<void>;
  startVAD: (onSpeechStart: () => void, onTranscript: (text: string) => void) => Promise<void>;
  stopVAD: () => Promise<void>;
  setAvatarSpeaking: (speaking: boolean) => void;
  kickCycle: () => Promise<void>;
};

export function useAvatarSTT(): UseAvatarSTTResult {
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const isRunningRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const onSpeechStartRef = useRef<(() => void) | null>(null);
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);
  const runCycleRef = useRef<(() => Promise<void>) | null>(null);
  // When true, failed VAD detections do not auto-restart the cycle (Andrew is speaking)
  const avatarSpeakingRef = useRef(false);

  const initAudio = useCallback(async () => {
    await Audio.requestPermissionsAsync();
  }, []);

  const setAvatarSpeaking = useCallback((speaking: boolean) => {
    avatarSpeakingRef.current = speaking;
  }, []);

  runCycleRef.current = async function runCycle() {
    if (!isRunningRef.current) return;

    // Switch to PlayAndRecord so WebRTC audio keeps playing AND mic can record
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    let recording: Audio.Recording;
    try {
      ({ recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS));
    } catch (e) {
      console.warn('[AvatarSTT] createAsync failed, retrying:', e);
      await new Promise((r) => setTimeout(r, 300));
      if (isRunningRef.current) await runCycleRef.current?.();
      return;
    }

    recordingRef.current = recording;
    recording.setProgressUpdateInterval(80);

    let isSpeaking = false;
    let speechStart = 0;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let isDone = false;

    recording.setOnRecordingStatusUpdate(async (status) => {
      if (isDone || !isRunningRef.current || !status.isRecording) return;

      const db = status.metering ?? -160;
      const now = Date.now();

      if (db > SPEECH_DB) {
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        if (!isSpeaking) {
          isSpeaking = true;
          speechStart = now;
          setIsUserSpeaking(true);
          onSpeechStartRef.current?.();
        }
      } else if (isSpeaking && !silenceTimer) {
        silenceTimer = setTimeout(async () => {
          if (isDone || !isRunningRef.current) return;
          isDone = true;

          const duration = Date.now() - speechStart;
          setIsUserSpeaking(false);

          const rec = recordingRef.current;
          recordingRef.current = null;
          try { await rec?.stopAndUnloadAsync(); } catch {}

          let transcript = '';
          if (duration >= MIN_SPEECH_MS && rec) {
            const uri = rec.getURI();
            if (uri) transcript = await transcribeAudio(uri);
          }

          if (!isRunningRef.current) return;

          if (transcript) {
            // Handler controls when to restart
            onTranscriptRef.current?.(transcript);
          } else if (!avatarSpeakingRef.current) {
            // Only auto-restart if Andrew is not currently speaking
            await runCycleRef.current?.();
          }
          // If avatarSpeakingRef.current: cycle ends here; kickCycle() will restart it after Andrew finishes
        }, SILENCE_MS);
      }
    });
  };

  const startVAD = useCallback(async (
    onSpeechStart: () => void,
    onTranscript: (text: string) => void,
  ) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    onSpeechStartRef.current = onSpeechStart;
    onTranscriptRef.current = onTranscript;
    await runCycleRef.current?.();
  }, []);

  const stopVAD = useCallback(async () => {
    isRunningRef.current = false;
    setIsUserSpeaking(false);
    const rec = recordingRef.current;
    recordingRef.current = null;
    try { await rec?.stopAndUnloadAsync(); } catch {}
  }, []);

  // Restart the VAD cycle if it's running but no recording is active (e.g. after Andrew finishes speaking)
  const kickCycle = useCallback(async () => {
    if (isRunningRef.current && !recordingRef.current) {
      await runCycleRef.current?.();
    }
  }, []);

  return { isUserSpeaking, initAudio, startVAD, stopVAD, setAvatarSpeaking, kickCycle };
}
