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

/**
 * Stream PCM 16-bit 24kHz audio from ElevenLabs to a callback.
 * Used by useLiveAvatarSession to forward audio chunks to LiveAvatar via WebSocket.
 */
// PCM 24kHz 16-bit mono = 48000 bytes per second
const PCM_BYTES_PER_MS = 48;

/**
 * Stream PCM audio to LiveAvatar. Returns the audio duration in milliseconds
 * so callers can sync animations to the actual speech length.
 */
export async function elevenLabsPCMStream(
  text: string,
  onChunk: (pcmBase64: string) => void,
  voiceIdOverride?: string
): Promise<number> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceIdOverride ?? VOICE_ID}/stream?output_format=pcm_24000`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) {
    let body = '';
    try { body = await response.text(); } catch {}
    console.error('[ElevenLabs] PCM stream HTTP error', response.status, body);
    throw new Error(`ElevenLabs PCM stream error ${response.status}: ${body}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const durationMs = bytes.byteLength / PCM_BYTES_PER_MS;
  console.log('[ElevenLabs] PCM audio downloaded, bytes:', bytes.byteLength, 'duration:', Math.round(durationMs), 'ms');

  const CHUNK = 4096;
  let chunkCount = 0;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    let binary = '';
    for (let j = 0; j < slice.byteLength; j++) binary += String.fromCharCode(slice[j]);
    onChunk(btoa(binary));
    chunkCount++;
  }
  console.log('[ElevenLabs] Sent', chunkCount, 'PCM chunks to avatar');
  return durationMs;
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
