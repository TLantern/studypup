/**
 * ElevenLabs TTS
 * Converts text to speech and plays it back via expo-av.
 */
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'; // default: Sarah

export function isElevenLabsConfigured(): boolean {
  return !!API_KEY;
}

let currentSound: Audio.Sound | null = null;

export async function stopElevenLabsAudio() {
  if (currentSound) {
    try { await currentSound.stopAsync(); } catch {}
    try { await currentSound.unloadAsync(); } catch {}
    currentSound = null;
    try { await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: true, defaultToSpeaker: true }); } catch {}
  }
}

export async function speakWithElevenLabs(
  text: string,
  onDone?: () => void,
  onError?: (e: unknown) => void,
  voiceIdOverride?: string
): Promise<void> {
  await stopElevenLabsAudio();

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceIdOverride ?? VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch {}
      console.error(`[ElevenLabs] HTTP ${response.status}${response.status === 402 ? ' — quota exceeded or insufficient credits' : ''}. Body: ${body}`);
      throw new Error(`ElevenLabs error ${response.status}`);
    }

    const blob = await response.blob();
    const reader = new FileReader();
    const base64: string = await new Promise((res, rej) => {
      reader.onloadend = () => res((reader.result as string).split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });

    const path = `${FileSystem.cacheDirectory}el_tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });

    // Recording is stopped before speak() is called, so disable recording mode
    // to get full loudspeaker volume (iOS throttles output when allowsRecordingIOS: true)
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, defaultToSpeaker: true });
    const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true, volume: 1.0 });
    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        currentSound = null;
        // Re-enable recording mode for the next VAD/barge-in cycle
        Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: true, defaultToSpeaker: true })
          .catch(() => {})
          .finally(() => onDone?.());
      }
    });
  } catch (e) {
    console.error('[ElevenLabs]', e);
    onError?.(e);
  }
}
