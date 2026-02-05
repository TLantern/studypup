/**
 * OpenAI Service
 * 
 * Wrapper for OpenAI API calls with error handling and retries
 */

import OpenAI from 'openai';

// Get API key from environment
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

// Initialize OpenAI client (will be null if no API key)
let openaiClient: OpenAI | null = null;

if (OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return openaiClient !== null && OPENAI_API_KEY.length > 0;
}

/**
 * Call OpenAI with structured JSON output
 */
export async function callOpenAI<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<T> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env');
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    return JSON.parse(content) as T;
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API call failed: ${error.message}`);
  }
}

/**
 * Call OpenAI with text output (no JSON parsing)
 */
export async function callOpenAIText(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env');
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    return content;
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API call failed: ${error.message}`);
  }
}

/**
 * Chat completion with full message history (for multi-turn)
 */
export async function callOpenAIChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env');
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }
    return content;
  } catch (error: any) {
    console.error('OpenAI chat error:', error);
    throw new Error(`Chat failed: ${error.message}`);
  }
}

/**
 * Extract text from an image using OpenAI Vision (works in React Native; Tesseract does not).
 */
export async function extractTextFromImageWithVision(imageDataUrl: string): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set EXPO_PUBLIC_OPENAI_API_KEY in .env');
  }
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: 'Extract all text from this image. Return only the raw text, no markdown or explanation.' },
      { role: 'user', content: [{ type: 'image_url', image_url: { url: imageDataUrl } }] } as OpenAI.ChatCompletionUserMessageParam,
    ],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return text.trim();
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}
