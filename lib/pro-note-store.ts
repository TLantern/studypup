import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { getRecordingJobById, removeRecordingJob } from './recording-jobs';

export interface ProNoteBullet {
  bold?: string;
  text: string;
}

export interface ProNoteTopicSegment {
  title: string;
  bullets: string[];
}

export interface ProNote {
  title: string;
  subtitle: string;
  overview: ProNoteBullet[];
  topicSegments?: ProNoteTopicSegment[];
  keyTopics: ProNoteBullet[];
  actionItems: string[];
  finalReflection: string;
  sourceUrl?: string;
  audioUri?: string;
  transcript?: string;
  folderId?: string | null;
  noteType?: 'todo';
  createdAt?: number;
  updatedAt?: number;
}

export type StoredProNote = ProNote & { id: string; createdAt: number; updatedAt: number };

export interface ProFolder {
  id: string;
  name: string;
  createdAt: number;
}

const NOTES_KEY = 'pro_notes:v1';
const FOLDERS_KEY = 'pro_folders:v1';

let _current: ProNote | null = null;
let _notes: StoredProNote[] = [];
let _folders: ProFolder[] = [];
let _hydrated = false;
let _hydrating: Promise<void> | null = null;
const _listeners = new Set<() => void>();

function emit() {
  _listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

function getUid(): string | null {
  try {
    return getFirebase().auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

function persistNotes() {
  AsyncStorage.setItem(NOTES_KEY, JSON.stringify(_notes)).catch((e) =>
    console.warn('[pro-notes] persistNotes failed', e)
  );
}

function persistFolders() {
  AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(_folders)).catch((e) =>
    console.warn('[pro-folders] persistFolders failed', e)
  );
}

function syncNoteToFirebase(note: StoredProNote) {
  const uid = getUid();
  if (!uid) return;
  try {
    const { db } = getFirebase();
    const ref = doc(db, 'professionals', uid, 'notes', note.id);
    setDoc(ref, note).catch((e) => console.warn('[pro-notes] sync note failed', e));
  } catch (e) {
    console.warn('[pro-notes] sync note threw', e);
  }
}

function deleteNoteFromFirebase(id: string) {
  const uid = getUid();
  if (!uid) return;
  try {
    const { db } = getFirebase();
    deleteDoc(doc(db, 'professionals', uid, 'notes', id)).catch((e) =>
      console.warn('[pro-notes] delete note failed', e)
    );
  } catch (e) {
    console.warn('[pro-notes] delete note threw', e);
  }
}

function syncFolderToFirebase(folder: ProFolder) {
  const uid = getUid();
  if (!uid) return;
  try {
    const { db } = getFirebase();
    const ref = doc(db, 'professionals', uid, 'folders', folder.id);
    setDoc(ref, folder).catch((e) => console.warn('[pro-folders] sync folder failed', e));
  } catch (e) {
    console.warn('[pro-folders] sync folder threw', e);
  }
}

function deleteFolderFromFirebase(id: string) {
  const uid = getUid();
  if (!uid) return;
  try {
    const { db } = getFirebase();
    deleteDoc(doc(db, 'professionals', uid, 'folders', id)).catch((e) =>
      console.warn('[pro-folders] delete folder failed', e)
    );
  } catch (e) {
    console.warn('[pro-folders] delete folder threw', e);
  }
}

export function subscribeProNotes(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function setCurrentProNote(note: ProNote) {
  _current = note;
}

export function getCurrentProNote(): ProNote | null {
  return _current;
}

export function addProNote(note: ProNote, explicitId?: string): string {
  const id = explicitId ?? `note_${Date.now()}`;
  const now = Date.now();
  const createdAt = note.createdAt ?? now;
  const stored: StoredProNote = { ...note, id, createdAt, updatedAt: now };
  // If a note with this id already exists (e.g. a resumed job re-running),
  // replace it in place rather than duplicating.
  _notes = [stored, ..._notes.filter((n) => n.id !== id)];
  _current = note;
  persistNotes();
  syncNoteToFirebase(stored);
  emit();
  return id;
}

export function getAllProNotes(): StoredProNote[] {
  return _notes;
}

export function getProNoteById(id: string): StoredProNote | null {
  return _notes.find((n) => n.id === id) ?? null;
}

export function updateProNote(id: string, patch: Partial<ProNote>): StoredProNote | null {
  const idx = _notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const updated: StoredProNote = { ..._notes[idx], ...patch, updatedAt: Date.now() };
  _notes = [..._notes];
  _notes[idx] = updated;
  persistNotes();
  syncNoteToFirebase(updated);
  emit();
  return updated;
}

export function deleteProNote(id: string): void {
  _notes = _notes.filter((n) => n.id !== id);
  persistNotes();
  deleteNoteFromFirebase(id);
  emit();
}

export function deleteAllProNotes(): void {
  const ids = _notes.map((n) => n.id);
  _notes = [];
  persistNotes();
  ids.forEach(deleteNoteFromFirebase);
  emit();
}

// ── Folders ────────────────────────────────────────────────────────────────
export function getAllFolders(): ProFolder[] {
  return _folders;
}

export function createFolder(name: string): ProFolder {
  const folder: ProFolder = {
    id: `folder_${Date.now()}`,
    name: name.trim(),
    createdAt: Date.now(),
  };
  _folders = [folder, ..._folders];
  persistFolders();
  syncFolderToFirebase(folder);
  emit();
  return folder;
}

export function deleteFolder(id: string): void {
  _folders = _folders.filter((f) => f.id !== id);
  const reassigned: StoredProNote[] = [];
  _notes = _notes.map((n) => {
    if (n.folderId !== id) return n;
    const next = { ...n, folderId: null, updatedAt: Date.now() };
    reassigned.push(next);
    return next;
  });
  persistFolders();
  persistNotes();
  deleteFolderFromFirebase(id);
  reassigned.forEach(syncNoteToFirebase);
  emit();
}

export function getNotesInFolder(folderId: string): StoredProNote[] {
  return _notes.filter((n) => n.folderId === folderId);
}

// ── Hydration ──────────────────────────────────────────────────────────────
export function hydrateProNotes(): Promise<void> {
  if (_hydrated) return Promise.resolve();
  if (_hydrating) return _hydrating;
  _hydrating = (async () => {
    // 1. Local cache first
    try {
      const [n, f] = await Promise.all([
        AsyncStorage.getItem(NOTES_KEY),
        AsyncStorage.getItem(FOLDERS_KEY),
      ]);
      if (n) _notes = JSON.parse(n);
      if (f) _folders = JSON.parse(f);
      if (n || f) emit();
    } catch (e) {
      console.warn('[pro-notes] local hydrate failed', e);
    }

    // 2. Background pull of folders from Firebase (skip if not signed in).
    //    Notes are not pulled here — they stream in via the realtime onSnapshot
    //    listener started in startProNotesSync(), which is also what makes a
    //    server-written note (Path B) appear without reopening the app.
    const uid = getUid();
    if (uid) {
      try {
        const { db } = getFirebase();
        const foldersSnap = await getDocs(collection(db, 'professionals', uid, 'folders'));
        const remoteFolders = foldersSnap.docs.map((d) => d.data() as ProFolder);

        if (remoteFolders.length || _folders.length) {
          const map = new Map<string, ProFolder>();
          _folders.forEach((f) => map.set(f.id, f));
          remoteFolders.forEach((f) => map.set(f.id, f));
          _folders = Array.from(map.values()).sort(
            (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
          );
          persistFolders();
          emit();
        }
      } catch (e) {
        console.warn('[pro-folders] remote hydrate failed', e);
      }
    }

    _hydrated = true;
  })();
  return _hydrating;
}

// ── Realtime notes sync ──────────────────────────────────────────────────────
/**
 * Merge a snapshot of remote notes into the in-memory store (union semantics:
 * remote wins on ties / newer updatedAt; local-only notes are kept). A remote
 * note whose id matches an in-flight recording job means that job's server-side
 * work finished, so the "Processing…" card is cleared.
 */
function mergeRemoteNotes(remoteNotes: StoredProNote[]) {
  if (!remoteNotes.length && !_notes.length) return;
  const map = new Map<string, StoredProNote>();
  _notes.forEach((n) => map.set(n.id, n));
  remoteNotes.forEach((n) => {
    const local = map.get(n.id);
    if (!local || (n.updatedAt ?? 0) >= (local.updatedAt ?? 0)) {
      map.set(n.id, n);
    }
  });
  _notes = Array.from(map.values()).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
  persistNotes();

  // A server-written note that matches a tracked job means that job is done.
  let completed = 0;
  remoteNotes.forEach((n) => {
    if (getRecordingJobById(n.id)) {
      removeRecordingJob(n.id);
      completed++;
    }
  });
  if (completed) notifyNotesReady(completed);

  emit();
}

/**
 * Fire a local "notes ready" notification when a server-processed recording
 * (Path B) lands while the app is backgrounded — the user closed the app during
 * the long upload/transcribe and should be told it finished.
 */
function notifyNotesReady(count: number) {
  if (AppState.currentState === 'active') return;
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your notes are ready',
      body:
        count > 1
          ? `${count} recordings have been turned into notes.`
          : 'Your recording has been turned into notes.',
    },
    trigger: null,
  }).catch(() => {});
}

let _notesUnsub: (() => void) | null = null;

/**
 * Start a realtime listener on professionals/{uid}/notes so notes (including
 * those written server-side by the Cloud Function) sync into the store as they
 * land. Idempotent — tears down any prior listener first (e.g. on user switch).
 * Returns an unsubscribe function.
 */
export function startProNotesSync(): () => void {
  if (_notesUnsub) {
    _notesUnsub();
    _notesUnsub = null;
  }
  const uid = getUid();
  if (!uid) return () => {};

  try {
    const { db } = getFirebase();
    const unsubFirestore = onSnapshot(
      collection(db, 'professionals', uid, 'notes'),
      (snap) => mergeRemoteNotes(snap.docs.map((d) => d.data() as StoredProNote)),
      (e) => console.warn('[pro-notes] notes listener error', e)
    );
    const stop = () => {
      unsubFirestore();
      if (_notesUnsub === stop) _notesUnsub = null;
    };
    _notesUnsub = stop;
    return stop;
  } catch (e) {
    console.warn('[pro-notes] startProNotesSync threw', e);
    return () => {};
  }
}
