import { callOpenAIText } from './openai-service';

export async function generateIntroScript(title: string, notes: string): Promise<string> {
  const system =
    'You are a friendly, engaging tutor. Write a spoken explanation — no bullet points, no headers, no markdown. Natural speech only. Keep it to 1-2 minutes when spoken aloud (roughly 150-250 words).';
  const user = `Topic: ${title}\n\nStudy notes:\n${notes}\n\nWrite a natural spoken introduction that a tutor would say to a student. Start directly with the content — no "Hello" or "Welcome".`;
  return callOpenAIText(system, user, { maxTokens: 400 });
}

export async function generateAvatarResponse(question: string, notes: string): Promise<string> {
  const system =
    'You are a friendly tutor answering a student question. Reply in 2-4 conversational sentences. No bullet points, no headers, no markdown. Natural speech only.';
  const user = `Study notes context:\n${notes}\n\nStudent question: ${question}`;
  return callOpenAIText(system, user, { maxTokens: 200 });
}
