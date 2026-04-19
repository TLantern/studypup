import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

export type UseAvatarSTTResult = {
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<string>;
};

export function useAvatarSTT(): UseAvatarSTTResult {
  const [isListening, setIsListening] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startListening = useCallback(async () => {
    if (recordingRef.current) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(async (): Promise<string> => {
    const recording = recordingRef.current;
    if (!recording) return '';

    setIsListening(false);
    await recording.stopAndUnloadAsync();
    recordingRef.current = null;

    const uri = recording.getURI();
    if (!uri) return '';

    // Send to OpenAI Whisper for transcription
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) return '';

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });

      if (!response.ok) return '';
      const data = await response.json();
      return (data.text ?? '').trim();
    } catch {
      return '';
    }
  }, []);

  return { isListening, startListening, stopListening };
}
