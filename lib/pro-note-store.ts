import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebase';

export interface ProNoteBullet {
  bold?: string;
  text: string;
}

export interface ProNote {
  title: string;
  subtitle: string;
  overview: ProNoteBullet[];
  keyTopics: ProNoteBullet[];
  actionItems: string[];
  finalReflection: string;
  sourceUrl?: string;
  audioUri?: string;
  transcript?: string;
  folderId?: string | null;
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

export function addProNote(note: ProNote): string {
  const id = `note_${Date.now()}`;
  const now = Date.now();
  const stored: StoredProNote = { ...note, id, createdAt: now, updatedAt: now };
  _notes = [stored, ..._notes];
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

    // 2. Background pull from Firebase (skip if not signed in)
    const uid = getUid();
    if (uid) {
      try {
        const { db } = getFirebase();
        const [notesSnap, foldersSnap] = await Promise.all([
          getDocs(collection(db, 'professionals', uid, 'notes')),
          getDocs(collection(db, 'professionals', uid, 'folders')),
        ]);
        const remoteNotes = notesSnap.docs.map((d) => d.data() as StoredProNote);
        const remoteFolders = foldersSnap.docs.map((d) => d.data() as ProFolder);

        if (remoteNotes.length || _notes.length) {
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
        }
        if (remoteFolders.length || _folders.length) {
          const map = new Map<string, ProFolder>();
          _folders.forEach((f) => map.set(f.id, f));
          remoteFolders.forEach((f) => map.set(f.id, f));
          _folders = Array.from(map.values()).sort(
            (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
          );
          persistFolders();
        }
        emit();
      } catch (e) {
        console.warn('[pro-notes] remote hydrate failed', e);
      }
    }

    _hydrated = true;
  })();
  return _hydrating;
}
