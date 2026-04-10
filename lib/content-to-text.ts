/**
 * Convert content items to unified text for knowledge graph extraction
 */

import type { ContentItem } from './content-store';
import { transcribeAudio } from './transcription';
import { extractTextFromImage } from './ocr';
import { extractDocumentText } from './document-extractor';
export type ConversionProgress = {
  current: number;
  total: number;
  itemName: string;
  status: 'converting' | 'done' | 'error';
};

/**
 * Convert all content items to a single text string
 */
export async function contentToText(
  items: ContentItem[],
  onProgress?: (p: ConversionProgress) => void
): Promise<string> {
  const parts: string[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.({ current: i + 1, total, itemName: item.name, status: 'converting' });

    try {
      let text = '';

      switch (item.type) {
        case 'notes':
          text = item.text || '';
          if (!text && item.uri && item.uri.startsWith('http')) text = `[Link: ${item.uri}]`;
          break;

        case 'audio':
          text = await transcribeAudio(item.uri);
          break;

        case 'image':
          text = await extractTextFromImage(item.uri);
          break;

        case 'file':
          text = await extractDocumentText(item.uri, item.name);
          break;

        default:
          text = '';
      }

      if (text) {
        parts.push(`--- ${item.name} ---\n${text}`);
      }
      onProgress?.({ current: i + 1, total, itemName: item.name, status: 'done' });
    } catch (err) {
      console.error(`Failed to convert ${item.name}:`, err);
      onProgress?.({ current: i + 1, total, itemName: item.name, status: 'error' });
      parts.push(`--- ${item.name} (conversion failed) ---\n`);
    }
  }

  return parts.join('\n\n') || '';
}
