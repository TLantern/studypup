import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = 'studypup_streak';
const EXTRA_STUDY_DAYS_KEY = 'studypup_extra_study_days';

export interface StreakData {
  count: number;
  lastDate: string; // YYYY-MM-DD
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getStreak(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastDate: '' };
}

async function saveStreak(data: StreakData): Promise<void> {
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export async function bumpStreak(n: number): Promise<void> {
  const streak = await getStreak();
  await saveStreak({ count: streak.count + n, lastDate: todayStr() });
}

export async function getExtraStudyDays(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_STUDY_DAYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addExtraStudyDays(dates: string[]): Promise<void> {
  const existing = await getExtraStudyDays();
  const merged = Array.from(new Set([...existing, ...dates]));
  await AsyncStorage.setItem(EXTRA_STUDY_DAYS_KEY, JSON.stringify(merged));
}

/**
 * Call when a study set reaches 75%+ mastery.
 * Returns the new streak if it was incremented today (for popup), else null.
 */
export async function recordMasteryAchieved(): Promise<number | null> {
  const today = todayStr();
  const streak = await getStreak();
  if (streak.lastDate === today) return null; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const newCount = streak.lastDate === yStr ? streak.count + 1 : 1;
  const updated: StreakData = { count: newCount, lastDate: today };
  await saveStreak(updated);
  return newCount;
}
