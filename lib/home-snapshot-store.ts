import type { Note } from '@/lib/notes';

export type WeekStat = { label: string; date: number; isToday: boolean; isFuture: boolean; studied: boolean };

type Snapshot = { notes: Note[]; weekStats: WeekStat[] };

let _snapshot: Snapshot = { notes: [], weekStats: [] };
const listeners = new Set<() => void>();

export function getHomeSnapshot(): Snapshot {
  return _snapshot;
}

export function setHomeSnapshot(snapshot: Snapshot): void {
  _snapshot = snapshot;
  listeners.forEach((listener) => listener());
}

export function subscribeHomeSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
