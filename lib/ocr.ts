/**
 * Tesseract OCR for images
 */

import Tesseract from 'tesseract.js';
import * as FileSystem from 'expo-file-system';

/**
 * Extract text from image using Tesseract OCR
 */
export async function extractTextFromImage(uri: string): Promise<string> {
  try {
    // Read image as base64 for Tesseract
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const {
      data: { text },
    } = await Tesseract.recognize(dataUrl, 'eng', {
      logger: () => {}, // Suppress logs
    });

    return (text || '').trim();
  } catch (error: any) {
    console.error('OCR error:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}
