import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { callOpenAI } from './openai-service';
import { getFirebase } from './firebase';
import { addProNote, type ProNote } from './pro-note-store';
import {
  addRecordingJob,
  getRecordingJobById,
  hydrateRecordingJobs,
  removeRecordingJob,
  updateRecordingJob,
  type RecordingJob,
  type RecordingJobMode,
} from './recording-jobs';
import { transcribeAudio } from './transcription';

function getUid(): string | null {
  try {
    return getFirebase().auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * Shared "recording → notes" pipeline used by both the professional and viral
 * home screens. Owns the note-generation prompt, the durability/resume logic,
 * and the routing decision between the on-device and (future) server paths.
 *
 * Recordings at or above this length are routed to the server path (upload to
 * Firebase Storage → Cloud Function transcribes + generates); shorter ones are
 * processed on-device.
 */
export const REMOTE_THRESHOLD_SEC = 6;

export function pickJobMode(durationSec: number): RecordingJobMode {
  return durationSec >= REMOTE_THRESHOLD_SEC ? 'remote' : 'local';
}

/** Generate a structured note from a transcript and save it under `noteId`. */
export async function generateNoteFromTranscript(
  transcript: string,
  extras: Partial<ProNote> = {},
  noteId?: string
): Promise<string> {
  const structured = await callOpenAI<{
    title: string;
    subtitle: string;
    overview: Array<{ bold?: string; text: string }>;
    topicSegments: Array<{ title: string; bullets: string[] }>;
    keyTopics: Array<{ bold?: string; text: string }>;
    actionItems: string[];
    finalReflection: string;
  }>(
    'You are an expert meeting intelligence AI. Return only valid JSON — no markdown, no code fences.',
    `Analyze this meeting transcript and return a JSON object with this exact shape:
{
  "title": "Meeting topic in 2-4 words",
  "subtitle": "One sentence describing the meeting and its main outcome",
  "overview": [
    { "bold": "Meeting Type", "text": "e.g. team standup, client call, strategy session, 1-on-1" },
    { "bold": "Core Objective", "text": "what the meeting was trying to accomplish" },
    { "bold": "Key Outcome", "text": "the main decision, result, or conclusion reached" }
  ],
  "topicSegments": [
    {
      "title": "Chapter name capturing this segment's theme (e.g. 'Q3 Budget Review', 'Hiring Plan', 'Product Roadmap')",
      "bullets": [
        "Key fact, decision, or data point from this segment",
        "Another important point discussed here",
        "Any conclusion or next step resolved in this segment"
      ]
    }
  ],
  "keyTopics": [
    { "bold": "Topic", "text": "why it matters and what was said about it" }
  ],
  "actionItems": [
    "Alice: Send the revised proposal to stakeholders (by Thursday)",
    "Bob: Book the venue for the offsite (within 2 weeks)",
    "Team: Complete sprint review before Monday standup"
  ],
  "finalReflection": "A 2-3 sentence summary of the meeting's significance and what to watch for going forward."
}

Rules:
- topicSegments: Break the meeting into 2-6 logical chapters IN THE ORDER they occurred. Each chapter needs 2-4 bullet points capturing the key facts, data, or decisions from that segment. Do not skip any meaningful topic covered.
- actionItems: Capture EVERY commitment or next step mentioned. Format each as "[Who]: [What] ([by when if stated])". Use a role or "Team" if no specific person was named. Omit the deadline clause if none was mentioned. Include at least one item if any work was referenced.
- overview: Exactly 3 bullets — meeting type, objective, and outcome.
- keyTopics: 3-6 topics explaining why each matters in context of this meeting.

Transcript:
${transcript.slice(0, 12000)}`
  );
  return addProNote({ ...structured, transcript, ...extras }, noteId);
}

// Guards against the same job being processed twice (e.g. both home screens
// mounting and resuming at once).
const _inFlight = new Set<string>();

/**
 * Run a job to completion, updating its status as it goes and surfacing any
 * failure as a retryable `failed` status. Routes to the on-device pipeline
 * (`local`) or the server upload pipeline (`remote`) based on `job.mode`.
 */
export async function processRecordingJob(job: RecordingJob): Promise<void> {
  if (_inFlight.has(job.id)) return;
  _inFlight.add(job.id);
  try {
    if (job.mode === 'remote') {
      await processRemoteJob(job);
    } else {
      await processLocalJob(job);
    }
  } catch (e: any) {
    console.error('[recording-pipeline] job failed', job.id, e);
    updateRecordingJob(job.id, {
      status: 'failed',
      message: e?.message ?? 'Could not process recording.',
    });
  } finally {
    _inFlight.delete(job.id);
  }
}

/**
 * On-device path: transcribe → generate → write note. On success the note is
 * written under the job id and the job removed.
 */
async function processLocalJob(job: RecordingJob): Promise<void> {
  updateRecordingJob(job.id, { status: 'processing', message: 'Transcribing audio…' });

  const transcript = await transcribeAudio(job.audioUri);
  if (!transcript.trim()) throw new Error('Transcription returned no text.');

  updateRecordingJob(job.id, { status: 'processing', message: 'Generating notes…' });
  await generateNoteFromTranscript(
    transcript,
    { audioUri: job.audioUri, createdAt: job.createdAt },
    job.id
  );

  removeRecordingJob(job.id);
}

/**
 * Server path (≥5 min recordings): upload the audio to Firebase Storage and let
 * the Cloud Function transcribe + generate. We hand off at upload-complete; the
 * finished note arrives via the pro-note-store onSnapshot listener, which clears
 * the job. The job is intentionally left in the store (status `processing`) as
 * the durable record that we're waiting on the server.
 */
async function processRemoteJob(job: RecordingJob): Promise<void> {
  // Already uploaded and waiting on the server — don't re-upload on resume.
  if (job.status === 'processing') return;

  const uid = getUid();
  if (!uid) {
    // No signed-in user means we can't reach the per-user storage path. Fall
    // back to the on-device pipeline so the recording is still turned into a
    // note rather than getting stuck.
    await processLocalJob(job);
    return;
  }

  updateRecordingJob(job.id, { status: 'uploading', message: 'Uploading recording… 0%' });

  const { storage } = getFirebase();
  const dest = storageRef(storage, `recordings/${uid}/${job.id}.m4a`);

  // Firebase JS SDK needs a Blob/ArrayBuffer; pull the local file in via fetch.
  const response = await fetch(job.audioUri);
  const blob = await response.blob();

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(dest, blob, {
      contentType: 'audio/m4a',
      // The Cloud Function reads createdAt to preserve note ordering.
      customMetadata: { jobId: job.id, createdAt: String(job.createdAt) },
    });
    task.on(
      'state_changed',
      (snap) => {
        const pct = snap.totalBytes
          ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          : 0;
        updateRecordingJob(job.id, {
          status: 'uploading',
          message: `Uploading recording… ${pct}%`,
        });
      },
      reject,
      resolve
    );
  });

  // Handed off to the server — the Cloud Function will write the note, which the
  // onSnapshot listener turns into a removeRecordingJob() once it lands.
  updateRecordingJob(job.id, {
    status: 'processing',
    message: 'Generating notes on server…',
  });
}

/**
 * Create a job for a freshly-stopped recording and start processing it.
 * Returns the job so the caller can reflect it in the UI immediately.
 */
export function startRecordingJob(params: {
  audioUri: string;
  durationSec: number;
}): RecordingJob {
  const id = `note_${Date.now()}`;
  const job = addRecordingJob({
    id,
    audioUri: params.audioUri,
    durationSec: params.durationSec,
    mode: pickJobMode(params.durationSec),
    status: 'pending',
  });
  // Fire-and-forget — durability comes from the persisted job, not this promise.
  processRecordingJob(job);
  return job;
}

/** Retry a job that previously failed. */
export function retryRecordingJob(id: string): void {
  const job = getRecordingJobById(id);
  if (job) processRecordingJob(job);
}

/**
 * On app launch / foreground: load persisted jobs and resume any that didn't
 * finish. This is what makes "close the app mid-processing" recoverable.
 */
export async function resumePendingRecordingJobs(): Promise<void> {
  const jobs = await hydrateRecordingJobs();
  for (const job of jobs) {
    if (!_inFlight.has(job.id)) processRecordingJob(job);
  }
}

let _errorsUnsub: (() => void) | null = null;

/**
 * Listen to professionals/{uid}/recordingJobErrors so a server-side failure
 * (Path B) flips the matching job to `failed` — turning the "Processing…" card
 * into a retry prompt. The error doc is consumed (deleted) once applied so it
 * doesn't re-mark a job the user has since retried. Idempotent; tears down any
 * prior listener (e.g. on user switch). Returns an unsubscribe function.
 */
export function startRecordingErrorsSync(): () => void {
  if (_errorsUnsub) {
    _errorsUnsub();
    _errorsUnsub = null;
  }
  const uid = getUid();
  if (!uid) return () => {};

  try {
    const { db } = getFirebase();
    const col = collection(db, 'professionals', uid, 'recordingJobErrors');
    const unsubFirestore = onSnapshot(
      col,
      (snap) => {
        snap.forEach((d) => {
          const err = d.data() as { id?: string; message?: string };
          const id = err.id ?? d.id;
          const job = getRecordingJobById(id);
          if (job && job.status !== 'failed') {
            updateRecordingJob(id, {
              status: 'failed',
              message: err.message ?? 'Could not process recording on the server.',
            });
          }
          // Consume the error so it can't re-fire after a retry.
          deleteDoc(doc(db, 'professionals', uid, 'recordingJobErrors', d.id)).catch(() => {});
        });
      },
      (e) => console.warn('[recording-pipeline] errors listener error', e)
    );
    const stop = () => {
      unsubFirestore();
      if (_errorsUnsub === stop) _errorsUnsub = null;
    };
    _errorsUnsub = stop;
    return stop;
  } catch (e) {
    console.warn('[recording-pipeline] startRecordingErrorsSync threw', e);
    return () => {};
  }
}

/**
 * Hook: resume pending recording jobs on mount AND whenever the app returns to
 * the foreground. Call this once from whichever screen owns the note list — the
 * _inFlight guard in processRecordingJob prevents double-processing if multiple
 * screens mount at the same time.
 */
export function useRecordingJobResume(): void {
  const resumedOnMount = useRef(false);

  useEffect(() => {
    if (!resumedOnMount.current) {
      resumedOnMount.current = true;
      resumePendingRecordingJobs();
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resumePendingRecordingJobs();
    });

    return () => sub.remove();
  }, []);
}
