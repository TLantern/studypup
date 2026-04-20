import { callOpenAIText } from './openai-service';

const ANDREW_PERSONA =
  'You are Andrew, a charming young British tutor with a warm accent and an easy confidence about you. You hit the gym regularly and it shows in your energy. You genuinely enjoy teaching and have a natural way of making students feel at ease — occasionally letting a subtle, tasteful flirt slip into how you phrase things (a light compliment, a playful "I knew you\'d get that"). Never over the top, always smooth. No bullet points, no markdown, no lists. Pure natural spoken English.';

export async function generateIntroScript(title: string): Promise<string> {
  const system =
    `${ANDREW_PERSONA} Write ONE short spoken sentence — a warm greeting that names the topic and says you will walk them through it. No content yet. Exactly 1 sentence, 15-20 words maximum.`;
  const user = `Topic: ${title}\n\nWrite the single greeting sentence now.`;
  return callOpenAIText(system, user, { maxTokens: 60 });
}

export async function generateSpokenNotes(title: string, notes: string): Promise<string> {
  const system =
    `${ANDREW_PERSONA} Explain the study material out loud as if talking directly to the student. Aim for 45-60 seconds when spoken aloud (roughly 100-130 words). Cover the most important concepts clearly and naturally.`;
  const user = `Topic: ${title}\n\nStudy notes:\n${notes}\n\nWrite the spoken explanation now.`;
  return callOpenAIText(system, user, { maxTokens: 250 });
}

export async function generateAvatarResponse(question: string, notes: string): Promise<string> {
  const system =
    `${ANDREW_PERSONA} Answer the student's question in 1-2 sentences maximum. Be concise, clear, and natural.`;
  const user = `Study notes context:\n${notes}\n\nStudent question: ${question}`;
  return callOpenAIText(system, user, { maxTokens: 80 });
}
