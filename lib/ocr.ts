/**
 * OCR for images. Uses OpenAI Vision (Tesseract.js requires Worker, which React Native does not have).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { extractTextFromImageWithVision, isOpenAIConfigured } from './openai-service';

export async function extractTextFromImage(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    if (!isOpenAIConfigured()) {
      throw new Error('OCR requires OpenAI API key. Set EXPO_PUBLIC_OPENAI_API_KEY in .env');
    }
    return await extractTextFromImageWithVision(dataUrl);
  } catch (error: any) {
    console.error('OCR error:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}
