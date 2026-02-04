/**
 * Content Store
 *
 * Persists pending content items between screens (index → choose-methods → generate)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_CONTENT_KEY = 'studypup_pending_content';

export type ContentItem = {
  uri: string;
  name: string;
  size?: number;
  type: 'audio' | 'image' | 'file' | 'notes';
  text?: string; // For pasted notes - raw text content
};

export async function savePendingContent(items: ContentItem[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_CONTENT_KEY, JSON.stringify(items));
}

export async function getPendingContent(): Promise<ContentItem[]> {
  const data = await AsyncStorage.getItem(PENDING_CONTENT_KEY);
  return data ? JSON.parse(data) : [];
}

export async function clearPendingContent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_CONTENT_KEY);
}
