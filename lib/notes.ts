// Note model and helper functions

import type { StudyMaterialSet } from './knowledge-graph';

export interface Note {
  id: string;
  emoji: string;
  name: string;
  date: string;
  mastery: number; // 0-100
  stats: {
    multipleChoice: { correct: number; total: number };
    flashcards: { correct: number; total: number };
    fillInBlanks: { correct: number; total: number };
    written: { correct: number; total: number };
  };
}

export const getMasteryColor = (mastery: number): string => {
  if (mastery < 25) return '#FF6B6B'; // red
  if (mastery < 50) return '#FFD93D'; // yellow
  if (mastery < 75) return '#6B9AFF'; // blue
  return '#6BCF7F'; // green
};

export const calculateMastery = (stats: Note['stats']): number => {
  let totalCorrect = 0;
  let totalQuestions = 0;
  const cats: (keyof Note['stats'])[] = ['multipleChoice', 'flashcards', 'fillInBlanks', 'written'];
  for (const k of cats) {
    const t = stats[k].total;
    if (t > 0) {
      totalCorrect += stats[k].correct;
      totalQuestions += t;
    }
  }
  if (totalQuestions === 0) return 0;
  return Math.round((totalCorrect / totalQuestions) * 100);
};

export const createNote = (
  emoji: string,
  name: string,
  stats?: Partial<Note['stats']>
): Note => {
  const defaultStats = {
    multipleChoice: { correct: 0, total: 0 },
    flashcards: { correct: 0, total: 0 },
    fillInBlanks: { correct: 0, total: 0 },
    written: { correct: 0, total: 0 },
    ...stats,
  };

  return {
    id: Date.now().toString(),
    emoji,
    name,
    date: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    mastery: calculateMastery(defaultStats),
    stats: defaultStats,
  };
};

export const updateNoteStats = (
  note: Note,
  questionType: keyof Note['stats'],
  correct: number,
  total: number
): Note => {
  const updatedStats = {
    ...note.stats,
    [questionType]: { correct, total },
  };

  return {
    ...note,
    stats: updatedStats,
    mastery: calculateMastery(updatedStats),
  };
};

/** Map a saved study material set (after knowledge graph + study content) to a Note for the home list. */
export function noteFromStudyMaterialSet(m: StudyMaterialSet): Note {
  const date = new Date(m.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const p = m.progress ?? {};
  const stats = {
    multipleChoice: { correct: p.multipleChoice ?? 0, total: m.quiz_questions?.length ?? 0 },
    flashcards: { correct: p.flashcards ?? 0, total: m.flashcards?.length ?? 0 },
    fillInBlanks: { correct: p.fillInBlanks ?? 0, total: m.fill_in_blank_questions?.length ?? 0 },
    written: { correct: p.written ?? 0, total: m.written_questions?.length ?? 0 },
  };
  return {
    id: m.id,
    emoji: m.emoji ?? '📚',
    name: m.title ?? 'Study Set',
    date,
    mastery: calculateMastery(stats),
    stats,
  };
}
