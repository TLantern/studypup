/**
 * YouTube transcript via RapidAPI youtube-transcript3
 */

import { fetch } from 'expo/fetch';

const TRANSCRIPT_HOST = 'youtube-transcript3.p.rapidapi.com';

interface TranscriptResponse {
  text: string;
  error?: string;
}

export function isYouTubeUrl(url: string): boolean {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export async function fetchYouTubeTranscript(
  videoId: string, 
  onProgress?: (message: string) => void
): Promise<TranscriptResponse> {
  const rapidApiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  
  if (!rapidApiKey) {
    return {
      text: '',
      error: 'API key not configured. Please check your environment variables.'
    };
  }

  try {
    onProgress?.('Fetching transcript...');

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const url = `https://${TRANSCRIPT_HOST}/api/transcript-with-url?url=${encodeURIComponent(videoUrl)}&flat_text=true&lang=en`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': TRANSCRIPT_HOST
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RapidAPI Error:', response.status, errorText);
      throw new Error(`Failed to get transcript: ${response.status}`);
    }

    const result = await response.text();
    if (result) {
      onProgress?.('Complete!');
      return { text: result };
    }
    throw new Error('No transcript text returned');
    
  } catch (error) {
    console.error('YouTube transcription error:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Failed to get YouTube transcript. Please try again.'
    };
  }
}

