# Background Recording → Notes: Implementation Plan

## Goal
User can close (or background) the app while a voice recording is being turned into notes without losing the recording or the processing work.

## Architecture Decision
- **< 5 minutes** → on-device pipeline (Whisper transcribe → GPT-4o generate → Firestore via `addProNote`)
- **≥ 5 minutes** → server-side pipeline (upload to Firebase Storage → Cloud Function transcribes + generates → writes note to Firestore → syncs to app)

---

## Status

### ✅ Phase 1 — Shared client foundation (DONE)
**New files:**
- `lib/recording-jobs.ts` — AsyncStorage-backed job store. Shape: `{ id, audioUri, durationSec, mode: 'local'|'remote', status: 'pending'|'uploading'|'processing'|'failed', message, createdAt, updatedAt }`. The job `id` doubles as the future note `id` for idempotency.
- `lib/recording-pipeline.ts` — shared brains: note-gen prompt (moved out of screens), `processRecordingJob`, `startRecordingJob`, `retryRecordingJob`, `resumePendingRecordingJobs`, `REMOTE_THRESHOLD_SEC = 300`, `pickJobMode`.

**Edited files:**
- `lib/pro-note-store.ts` — `addProNote(note, explicitId?)` now accepts an optional id and replaces in place (idempotent resume).
- `app/professional-home.tsx` + `app/viral-professional-home.tsx`:
  - `stopAndSave` moves audio from cache → `documentDirectory/recordings/`, creates a job, closes the sheet immediately (non-blocking).
  - "Processing recording…" card in the note list (spinner while pending, error icon + retry/dismiss on failure).
  - Both screens subscribe to `recordingJobs` state.

### ✅ Phase 2 — Path A polish (DONE)
**Edited files:**
- `lib/recording-pipeline.ts` — added `useRecordingJobResume()` hook: resumes pending jobs on mount AND on every `AppState → 'active'` (app foreground). `_inFlight` guard prevents double-processing.
- `app/professional-home.tsx` + `app/viral-professional-home.tsx`:
  - Replaced manual resume calls with `useRecordingJobResume()`.
  - `pickAudio` (upload local audio file) now also routes through `startRecordingJob`.
  - Removed dead state: `savingRecording`, `savingMessage`, `showFirstRecordingOverlay`, `overlayAlmostDone`.
  - Removed the two blocking overlay Modals and their styles.

---

### ✅ Phase 3 — Path B client: upload to Firebase Storage (DONE)
**What:** When `durationSec >= 300`, instead of running Whisper on-device, upload the audio file to Firebase Storage and let the server do the work.

**Edited files:**
1. `lib/firebase.ts` — added `storage` (`getStorage`) to the cached `FirebaseServices` singleton.
2. `lib/recording-pipeline.ts` — `processRecordingJob` now branches by `job.mode`:
   - `processLocalJob` = the original on-device transcribe → generate → write path.
   - `processRemoteJob` = `fetch(audioUri).blob()` → `uploadBytesResumable` to `recordings/{uid}/{jobId}.m4a` with `'uploading'` % progress messages → on complete sets status `'processing'` ("Generating notes on server…") and hands off (Cloud Function writes the note). Already-`processing` remote jobs are skipped on resume so they aren't re-uploaded. No signed-in user falls back to the on-device path so the recording is never stuck.
3. `lib/pro-note-store.ts` — notes are no longer pulled via one-shot `getDocs` (folders still are). Added `startProNotesSync()`: an `onSnapshot` listener on `professionals/{uid}/notes` that merges remote notes in (union semantics, idempotent, tears down prior listener on user switch) and calls `removeRecordingJob(id)` when an arriving note matches a tracked job — this is what makes the server-written note appear and dismiss the "Processing…" card without reopening the app.
4. `app/_layout.tsx` — added `<ProNotesSync />` inside `AuthProvider`; starts/stops `startProNotesSync()` on `uid` change.

**No native rebuild needed** — all Firebase JS SDK.

> ⚠️ Path B end-to-end requires **Phase 4** (the Cloud Function + Storage rules). Until that ships, a ≥5-min recording will upload and sit at "Generating notes on server…" with nothing writing the note. Either finish Phase 4 or temporarily raise `REMOTE_THRESHOLD_SEC` to keep everything on-device.

---

### ✅ Phase 4 — Cloud Function (DONE)
**What:** An `onObjectFinalized` trigger on Firebase Storage that transcribes the audio with OpenAI Whisper (+ chunking for large files) and writes the finished note to Firestore.

> **Note:** Firebase config lives at the **repo root** (`/Users/tenbandz/Code/Studypup`), not the `studypup` submodule. `functions/`, `storage.rules`, and `firebase.json` are all there.

#### 4a — Firebase Functions project (DONE)
Created `functions/` manually (equivalent to `firebase init functions`, non-interactive): `package.json` (Node 20, gen2 deps), `tsconfig.json`, `.gitignore`, `src/index.ts`. Added the `functions` + `storage` blocks to root `firebase.json`.

#### 4b — Storage rules (DONE)
`storage.rules` created (owner-write / read-deny on `recordings/{uid}/{jobId}`) and wired into `firebase.json`.

#### 4c — The function `functions/src/index.ts` → `processRecording` (DONE)
- Trigger: `onObjectFinalized` bound to bucket `studypup-b3973.firebasestorage.app`, `timeoutSeconds: 540`, `memory: '1GiB'`, `secrets: [OPENAI_API_KEY]`.
- Ignores non-`recordings/` objects; parses `uid` + `jobId` from the path. **Idempotent** — skips if the note already exists.
- Downloads to `/tmp/{jobId}/input.m4a`. Transcribes with `gpt-4o-transcribe` (same speaker-label prompt as on-device); files **> 24 MB** are split into ~10-min segments with a bundled static `ffmpeg` (`ffmpeg-static`), transcribed in order, and stitched.
- Generates the note with `gpt-4o-mini` using the **exact same JSON prompt** as `lib/recording-pipeline.ts`.
- Writes `professionals/{uid}/notes/{jobId}` as a `StoredProNote`: `audioUri` = a Firebase download-token URL (works despite the read-deny rule), `transcript`, `createdAt` (read from upload metadata so ordering matches on-device), `updatedAt`.
- On error: writes `{ id, status: 'failed', message }` to `professionals/{uid}/recordingJobErrors/{jobId}`. Cleans up `/tmp` in `finally`.

**Client glue added to complete Path B (beyond the original plan):**
- `lib/recording-pipeline.ts` — `processRemoteJob` now tags the upload with `customMetadata.createdAt`; new `startRecordingErrorsSync()` listens to `recordingJobErrors`, flips the matching job to `failed` (→ retry card), and consumes the error doc.
- `firestore.rules` — added a `recordingJobErrors` subcollection (owner read/delete, client write denied).
- `app/_layout.tsx` — `ProNotesSync` now also starts `startRecordingErrorsSync()`.

#### 4d — "Notes ready" local notification (DONE)
`lib/pro-note-store.ts` → `mergeRemoteNotes` fires `expo-notifications` (`notifyNotesReady`) when a server-written note clears a tracked job **while the app is backgrounded**.

#### ⚠️ Manual steps to go live (require your credentials / CLI)
Run from the repo root (`/Users/tenbandz/Code/Studypup`):
```bash
cd functions && npm install && cd ..          # already done locally
firebase functions:secrets:set OPENAI_API_KEY # paste the key when prompted
firebase deploy --only functions,storage,firestore:rules
```
- Confirm Storage is enabled for the project and the default bucket is `studypup-b3973.firebasestorage.app` (the trigger is pinned to it). If the bucket id differs, update the `bucket:` option in `functions/src/index.ts`.
- gen2 Storage triggers also need the Eventarc / Cloud Run APIs enabled — `firebase deploy` will prompt to enable them on first deploy.

---

## Key file map
| File | Role |
|------|------|
| `lib/recording-jobs.ts` | AsyncStorage job store |
| `lib/recording-pipeline.ts` | Pipeline logic + `useRecordingJobResume` hook |
| `lib/pro-note-store.ts` | Note store (needs `onSnapshot` in Phase 3) |
| `lib/transcription.ts` | On-device Whisper (unchanged) |
| `app/professional-home.tsx` | Main notes screen (wired) |
| `app/viral-professional-home.tsx` | Viral variant (wired, mirrors professional-home) |
| `../functions/src/index.ts` | Cloud Function `processRecording` (repo root, created) |
| `../storage.rules` | Firebase Storage security rules (repo root, created) |
| `../firestore.rules` | `recordingJobErrors` subcollection rule added (repo root) |
| `../firebase.json` | `functions` + `storage` blocks added (repo root) |

## Important constraints
- **Transcription engine:** on-device and Cloud Function both use **OpenAI Whisper** (`gpt-4o-transcribe`). Google Meet capture uses **Deepgram** via `meet-capture-server` — leave that untouched.
- **Firestore path for notes:** `professionals/{uid}/notes/{noteId}` (existing, rules already allow user read/write).
- **`expo-file-system/legacy`** — the whole codebase uses this import path, not `expo-file-system`.
- **React version:** pinned to `19.1.0` (matches `react-native@0.81.5` renderer — do not bump).
- Firebase project: `studypup-b3973`, storage bucket: `studypup-b3973.firebasestorage.app`.
