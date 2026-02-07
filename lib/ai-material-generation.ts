/**
 * AI-Powered Study Material Generation
 * 
 * Uses OpenAI to generate high-quality study materials from knowledge graphs
 */

import type {
  KnowledgeGraph,
  Flashcard,
  QuizQuestion,
  WrittenQuestion,
  FillInBlankQuestion,
} from './knowledge-graph';
import { callOpenAI, isOpenAIConfigured } from './openai-service';

/**
 * Generate flashcards using AI
 */
export async function generateFlashcardsWithAI(
  graph: KnowledgeGraph,
  count: number = 10
): Promise<Flashcard[]> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert at creating educational flashcards.
Create engaging, clear flashcards that help students learn and retain information.

Rules:
- Front: Ask a clear, specific question
- Back: Provide a concise, accurate answer
- Use simple language appropriate for the student's level
- Focus on key concepts and their relationships
- Include enough context in the question to avoid ambiguity`;

  const userPrompt = `Create ${count} flashcards from this knowledge graph:

${JSON.stringify(graph.concepts, null, 2)}

Return JSON in this exact format:
{
  "flashcards": [
    {
      "concept_id": "concept_id_from_graph",
      "front": "Question on the front",
      "back": "Answer on the back"
    }
  ]
}`;

  const response = await callOpenAI<{ flashcards: Array<{ concept_id: string; front: string; back: string }> }>(
    systemPrompt,
    userPrompt,
    { temperature: 0.7 }
  );

  return response.flashcards.map((fc, i) => ({
    id: `fc_ai_${graph.id}_${i}`,
    concept_id: fc.concept_id,
    front: fc.front,
    back: fc.back,
  }));
}

/**
 * Generate quiz questions using AI
 */
export async function generateQuizQuestionsWithAI(
  graph: KnowledgeGraph,
  count: number = 10
): Promise<QuizQuestion[]> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert at creating educational quiz questions.
Create challenging multiple-choice questions that test understanding, not just memorization.

Rules:
- Write clear, specific questions
- Provide 4 answer options
- Make distractors plausible but clearly wrong to someone who understands
- Use common_mistakes from concepts to create good distractors
- Include brief explanations for why the correct answer is correct
- Vary question types: definition, application, comparison, cause-effect`;

  const userPrompt = `Create ${count} multiple-choice quiz questions from this knowledge graph:

${JSON.stringify(graph.concepts, null, 2)}

Return JSON in this exact format:
{
  "questions": [
    {
      "concept_id": "concept_id_from_graph",
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}`;

  const response = await callOpenAI<{
    questions: Array<{
      concept_id: string;
      question: string;
      options: string[];
      correct_answer_index: number;
      explanation: string;
    }>;
  }>(systemPrompt, userPrompt, { temperature: 0.7 });

  return response.questions.map((q, i) => ({
    id: `quiz_ai_${graph.id}_${i}`,
    concept_id: q.concept_id,
    question: q.question,
    options: q.options,
    correct_answer_index: q.correct_answer_index,
    explanation: q.explanation,
  }));
}

/**
 * Generate written questions using AI
 */
export async function generateWrittenQuestionsWithAI(
  graph: KnowledgeGraph,
  count: number = 5
): Promise<WrittenQuestion[]> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert at creating short-answer questions.
Create simple, direct questions that can be answered in 1-2 sentences.

Rules:
- Keep questions short and clear (one sentence maximum)
- Ask for specific facts, definitions, or brief explanations
- Answers should be concise (1-2 sentences, no more than 30 words)
- Focus on core concepts and key facts
- Avoid complex analysis or multi-part questions`;

  const userPrompt = `Create ${count} short-answer questions from this knowledge graph:

${JSON.stringify(graph.concepts, null, 2)}

Return JSON in this exact format:
{
  "questions": [
    {
      "concept_id": "concept_id_from_graph",
      "question": "The essay question",
      "rubric": ["Point 1 student should address", "Point 2 student should address"],
      "sample_answer": "Example of a good answer"
    }
  ]
}`;

  const response = await callOpenAI<{
    questions: Array<{
      concept_id: string;
      question: string;
      rubric: string[];
      sample_answer: string;
    }>;
  }>(systemPrompt, userPrompt, { temperature: 0.7 });

  return response.questions.map((q, i) => ({
    id: `written_ai_${graph.id}_${i}`,
    concept_id: q.concept_id,
    question: q.question,
    rubric: q.rubric,
    sample_answer: q.sample_answer,
  }));
}

/**
 * Generate fill-in-the-blank questions using AI
 */
export async function generateFillInBlankQuestionsWithAI(
  graph: KnowledgeGraph,
  count: number = 10
): Promise<FillInBlankQuestion[]> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI not configured');
  }

  const systemPrompt = `You are an expert at creating fill-in-the-blank questions.
Create questions that test key terminology and concepts through context clues.

Rules:
- Use ___ to indicate the blank
- Provide enough context to make the answer unambiguous
- Focus on important terms, not trivial details
- Make sure the blank tests understanding, not just memorization
- Each question should have exactly one clear correct answer`;

  const userPrompt = `Create ${count} fill-in-the-blank questions from this knowledge graph:

${JSON.stringify(graph.concepts, null, 2)}

Return JSON in this exact format:
{
  "questions": [
    {
      "concept_id": "concept_id_from_graph",
      "text": "Text with ___ indicating the blank",
      "answer": "The correct word or phrase",
      "context": "Additional context if needed"
    }
  ]
}`;

  const response = await callOpenAI<{
    questions: Array<{
      concept_id: string;
      text: string;
      answer: string;
      context?: string;
    }>;
  }>(systemPrompt, userPrompt, { temperature: 0.7 });

  return response.questions.map((q, i) => ({
    id: `fib_ai_${graph.id}_${i}`,
    concept_id: q.concept_id,
    text: q.text,
    answer: q.answer,
    context: q.context,
  }));
}

const NOTES_FORMAT_SYSTEM_PROMPT = `You are a structured note formatter 📘✨

Your job is to convert ANY subject into notes using the EXACT format below.
The subject may change. The format MUST NOT change.

RULES:
- Follow the format exactly and in order
- Do not add, remove, rename, or reorder sections
- Use clear, student-friendly language 🧠
- Use light emojis in section headers only
- If information is missing, infer it
- No commentary outside the format
- If structure is violated, the output is invalid

FORMAT (use exactly this):

## 📌 Title
<topic name>

## 🧠 Core Idea
<1–2 paragraph first-principles explanation>

## ⚙️ Key Sections
### <Section Name>
- Explanation:
  <clear explanation>
- Steps / Mechanism:
  - <bullet>
  - <bullet>

## 🧮 Equations / Formulas (if applicable)
<LaTeX or "Not applicable">

## ✨ Simplified Summary
<plain-English takeaway>

## ⭐ Why This Matters
<real-world or exam relevance>`;

/**
 * Generate structured notes using AI
 */
export async function generateNotesWithAI(graph: KnowledgeGraph): Promise<string> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI not configured');
  }

  const userPrompt = `Convert this knowledge graph into structured notes using the EXACT format specified:

${JSON.stringify(graph.concepts, null, 2)}

Return JSON with the notes in markdown:
{
  "notes": "## 📌 Title\\n\\n..."
}`;

  const response = await callOpenAI<{ notes: string }>(
    NOTES_FORMAT_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.7, maxTokens: 4000 }
  );

  return response.notes;
}

/**
 * Revise existing notes with a user instruction (e.g. "make it shorter", "add more on X").
 */
export async function reviseNotesWithAI(notes: string, instruction: string): Promise<string> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI not configured');
  }
  const systemPrompt = `You are an expert at improving study notes. Given existing notes and a user request, revise the notes accordingly. Keep the same markdown structure (## 📌 Title, ## 🧠 Core Idea, etc.) and return only the revised notes.`;
  const userPrompt = `Current notes:\n\n${notes}\n\nUser request: ${instruction}\n\nReturn JSON: { "notes": "revised markdown here" }`;
  const response = await callOpenAI<{ notes: string }>(
    systemPrompt,
    userPrompt,
    { temperature: 0.5, maxTokens: 4000 }
  );
  return response.notes;
}

export type MaterialType = 'flashcards' | 'quiz' | 'written' | 'fill' | 'notes';

/**
 * Generate only selected material types
 */
export async function generateSelectedMaterialsWithAI(
  graph: KnowledgeGraph,
  types: MaterialType[],
  options?: { flashcardCount?: number; quizCount?: number; writtenCount?: number; fillBlankCount?: number }
): Promise<{
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  written: WrittenQuestion[];
  fillBlanks: FillInBlankQuestion[];
  notes: string;
}> {
  const result = {
    flashcards: [] as Flashcard[],
    quizzes: [] as QuizQuestion[],
    written: [] as WrittenQuestion[],
    fillBlanks: [] as FillInBlankQuestion[],
    notes: '',
  };

  const tasks: Promise<void>[] = [];
  if (types.includes('flashcards')) {
    tasks.push(generateFlashcardsWithAI(graph, options?.flashcardCount ?? 10).then((f) => { result.flashcards = f; }));
  }
  if (types.includes('quiz')) {
    tasks.push(generateQuizQuestionsWithAI(graph, options?.quizCount ?? 10).then((q) => { result.quizzes = q; }));
  }
  if (types.includes('written')) {
    tasks.push(generateWrittenQuestionsWithAI(graph, options?.writtenCount ?? 5).then((w) => { result.written = w; }));
  }
  if (types.includes('fill')) {
    tasks.push(generateFillInBlankQuestionsWithAI(graph, options?.fillBlankCount ?? 10).then((f) => { result.fillBlanks = f; }));
  }
  if (types.includes('notes')) {
    tasks.push(generateNotesWithAI(graph).then((n) => { result.notes = n; }));
  }

  await Promise.all(tasks);
  return result;
}

/**
 * Generate all materials at once (batch for efficiency)
 */
export async function generateAllMaterialsWithAI(
  graph: KnowledgeGraph,
  options?: {
    flashcardCount?: number;
    quizCount?: number;
    writtenCount?: number;
    fillBlankCount?: number;
  }
): Promise<{
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  written: WrittenQuestion[];
  fillBlanks: FillInBlankQuestion[];
  notes: string;
}> {
  // Generate all materials in parallel for speed
  const [flashcards, quizzes, written, fillBlanks, notes] = await Promise.all([
    generateFlashcardsWithAI(graph, options?.flashcardCount ?? 10),
    generateQuizQuestionsWithAI(graph, options?.quizCount ?? 10),
    generateWrittenQuestionsWithAI(graph, options?.writtenCount ?? 5),
    generateFillInBlankQuestionsWithAI(graph, options?.fillBlankCount ?? 10),
    generateNotesWithAI(graph),
  ]);

  return { flashcards, quizzes, written, fillBlanks, notes };
}
