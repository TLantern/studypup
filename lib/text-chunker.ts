/**
 * Token-safe text chunking (500–1500 tokens per chunk).
 * Splits on paragraph → sentence → hard-char boundaries.
 * ~4 chars per token (GPT approximation).
 */

const CHARS_PER_TOKEN = 4;

export type TextChunk = {
  index: number;
  text: string;
  estimatedTokens: number;
};

export function chunkText(
  text: string,
  maxTokens = 1500,
  minTokens = 500
): TextChunk[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const minChars = minTokens * CHARS_PER_TOKEN;

  const paragraphs = text.split(/\n\n+/);
  const segments: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      segments.push(para);
    } else {
      // Split long paragraph on sentence boundaries
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      for (const sentence of sentences) {
        if (sentence.length <= maxChars) {
          segments.push(sentence.trim());
        } else {
          // Hard-split oversized sentence
          for (let i = 0; i < sentence.length; i += maxChars) {
            segments.push(sentence.slice(i, i + maxChars).trim());
          }
        }
      }
    }
  }

  const chunks: TextChunk[] = [];
  let current = '';

  for (const seg of segments) {
    if (!seg) continue;
    const next = current ? `${current}\n\n${seg}` : seg;
    if (next.length > maxChars && current.length >= minChars) {
      chunks.push(makeChunk(chunks.length, current));
      current = seg;
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(makeChunk(chunks.length, current));

  return chunks;
}

function makeChunk(index: number, text: string): TextChunk {
  return { index, text: text.trim(), estimatedTokens: Math.ceil(text.length / CHARS_PER_TOKEN) };
}
