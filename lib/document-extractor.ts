/**
 * Document text extraction for PDF, DOCX, and PPTX files.
 *
 * PDF:  OpenAI Files API upload → gpt-4o extraction → OCR fallback
 * DOCX: jszip + word/document.xml strip
 * PPTX: jszip + ppt/slides/*.xml bullet extraction
 */

import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { extractTextFromImage } from './ocr';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const OPENAI_BASE = 'https://api.openai.com/v1';

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function extractPDF(uri: string, name: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  let fileId: string | null = null;
  try {
    fileId = await uploadToOpenAI(uri, name, 'application/pdf');
    const text = await extractTextViaGPT(fileId);
    if (text.trim().length > 0) return text;
    throw new Error('Empty response from GPT');
  } catch (err: any) {
    console.warn('[document-extractor] PDF GPT extraction failed, falling back to OCR:', err.message);
    return extractTextFromImage(uri);
  } finally {
    if (fileId) deleteOpenAIFile(fileId).catch(() => {});
  }
}

async function uploadToOpenAI(uri: string, name: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri, name, type: mimeType } as any);
  formData.append('purpose', 'user_data');

  const res = await fetch(`${OPENAI_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI file upload failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.id as string;
}

async function extractTextViaGPT(fileId: string): Promise<string> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all text from this document. Return only the raw text content, preserving paragraph structure. No commentary.' },
            { type: 'file', file: { file_id: fileId } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GPT extraction failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  return (json.choices?.[0]?.message?.content ?? '').trim();
}

async function deleteOpenAIFile(fileId: string): Promise<void> {
  await fetch(`${OPENAI_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  });
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

export async function extractDOCX(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(base64, { base64: true });

  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('word/document.xml not found in DOCX');

  const xml = await xmlFile.async('string');
  return stripDocxXml(xml);
}

function stripDocxXml(xml: string): string {
  // Inject newlines at paragraph/break boundaries before stripping tags
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:br[^/]*/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x[0-9A-Fa-f]+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── PPTX ────────────────────────────────────────────────────────────────────

export async function extractPPTX(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(base64, { base64: true });

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) throw new Error('No slide XML files found in PPTX');

  const slides: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i])!.async('string');
    const text = extractSlideText(xml);
    if (text) slides.push(`[Slide ${i + 1}]\n${text}`);
  }

  return slides.join('\n\n');
}

function extractSlideText(xml: string): string {
  // Extract <a:t> text runs (covers titles, body text, bullet points)
  const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
  return matches
    .map((m) => m.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function extractDocumentText(uri: string, name: string): Promise<string> {
  const lower = name.toLowerCase();

  if (lower.endsWith('.pdf')) return extractPDF(uri, name);
  if (lower.endsWith('.docx')) return extractDOCX(uri);
  if (lower.endsWith('.pptx')) return extractPPTX(uri);

  // Plain text
  if (/\.(txt|md|csv)$/.test(lower)) {
    return FileSystem.readAsStringAsync(uri);
  }

  // Image extensions — delegate to existing OCR
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(lower)) {
    return extractTextFromImage(uri);
  }

  throw new Error(`Unsupported file type: ${name}`);
}
