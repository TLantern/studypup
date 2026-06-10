import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistent record of an in-flight "recording → notes" job.
 *
 * A job is created the instant a recording is stopped, BEFORE any network work
 * begins, and lives in AsyncStorage so it survives the app being backgrounded
 * or killed. On the next launch we scan for unfinished jobs and resume them
 * (see lib/recording-pipeline.ts), so a recording is never lost mid-processing.
 *
 * The job `id` is reused as the resulting note id so the "Processing…" card in
 * the home list maps cleanly onto the finished note once it arrives.
 */

export type RecordingJobStatus = 'pending' | 'uploading' | 'processing' | 'failed';
export type RecordingJobMode = 'local' | 'remote';

export interface RecordingJob {
  id: string;
  audioUri: string;       // persistent documentDirectory path
  durationSec: number;
  mode: RecordingJobMode;  // 'local' = on-device pipeline, 'remote' = server (≥5min)
  status: RecordingJobStatus;
  message?: string;        // user-facing progress / error text
  createdAt: number;
  updatedAt: number;
}

const JOBS_KEY = 'recording_jobs:v1';

let _jobs: RecordingJob[] = [];
let _hydrated = false;
let _hydrating: Promise<RecordingJob[]> | null = null;
const _listeners = new Set<() => void>();

function emit() {
  _listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

function persist() {
  AsyncStorage.setItem(JOBS_KEY, JSON.stringify(_jobs)).catch((e) =>
    console.warn('[recording-jobs] persist failed', e)
  );
}

export function subscribeRecordingJobs(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function getRecordingJobs(): RecordingJob[] {
  return _jobs;
}

export function getRecordingJobById(id: string): RecordingJob | null {
  return _jobs.find((j) => j.id === id) ?? null;
}

export function addRecordingJob(
  job: Omit<RecordingJob, 'createdAt' | 'updatedAt'>
): RecordingJob {
  const now = Date.now();
  const full: RecordingJob = { ...job, createdAt: now, updatedAt: now };
  _jobs = [full, ..._jobs.filter((j) => j.id !== job.id)];
  persist();
  emit();
  return full;
}

export function updateRecordingJob(
  id: string,
  patch: Partial<Omit<RecordingJob, 'id' | 'createdAt'>>
): RecordingJob | null {
  const idx = _jobs.findIndex((j) => j.id === id);
  if (idx === -1) return null;
  const updated: RecordingJob = { ..._jobs[idx], ...patch, updatedAt: Date.now() };
  _jobs = [..._jobs];
  _jobs[idx] = updated;
  persist();
  emit();
  return updated;
}

export function removeRecordingJob(id: string): void {
  const before = _jobs.length;
  _jobs = _jobs.filter((j) => j.id !== id);
  if (_jobs.length !== before) {
    persist();
    emit();
  }
}

/**
 * Load persisted jobs into memory. Safe to call repeatedly — only the first
 * call hits storage. Returns the hydrated jobs so callers can resume them.
 */
export function hydrateRecordingJobs(): Promise<RecordingJob[]> {
  if (_hydrated) return Promise.resolve(_jobs);
  if (_hydrating) return _hydrating;
  _hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(JOBS_KEY);
      if (raw) {
        _jobs = JSON.parse(raw);
        emit();
      }
    } catch (e) {
      console.warn('[recording-jobs] hydrate failed', e);
    }
    _hydrated = true;
    return _jobs;
  })();
  return _hydrating;
}
