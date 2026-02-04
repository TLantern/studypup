/**
 * Whisper transcription for audio files
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

/**
 * Transcribe audio file to text using OpenAI Whisper
 */
export async function transcribeAudio(uri: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as any);
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Whisper transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}
