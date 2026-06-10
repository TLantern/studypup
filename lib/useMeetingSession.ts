import { useEffect, useRef, useState, useCallback } from 'react';
import { ref, onChildAdded, set, off, type DatabaseReference } from 'firebase/database';
import { randomUUID } from 'expo-crypto';
import { getFirebase } from './firebase';

const CAPTURE_WS_URL = process.env.EXPO_PUBLIC_CAPTURE_MEETING_WS_URL ?? '';

export type TranscriptChunk = {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
};

export const SPEAKER_COLORS = [
  '#A78BFA',
  '#60A5FA',
  '#34D399',
  '#F87171',
  '#FBBF24',
  '#F472B6',
];

export type SessionStatus = 'idle' | 'waiting' | 'active' | 'ended' | 'error';

export function useMeetingSession(userId: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<DatabaseReference | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const wsActiveRef = useRef(false);
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectAttemptsRef = useRef(0);

  const createSession = useCallback(async (): Promise<string> => {
    console.log(`🆕 [useMeetingSession] Creating session — user: ${userId}`);
    const { rtdb } = getFirebase();
    const id = randomUUID();
    const code = id.slice(0, 8).toUpperCase();
    console.log(`🔑 [useMeetingSession] Session UUID: ${id} — display code: ${code}`);
    const sessionRef = ref(rtdb, `meetings/${id}`);
    await set(sessionRef, {
      createdBy: userId,
      createdAt: Date.now(),
      status: 'waiting',
    });
    console.log(`✅ [useMeetingSession] Session written to Firebase — code: ${code}`);
    setSessionId(id);
    setStatus('waiting');
    setChunks([]);
    setError(null);
    return id;
  }, [userId]);

  const startListening = useCallback((id: string) => {
    const code = id.slice(0, 8).toUpperCase();
    console.log(`🚀 [useMeetingSession] Starting listeners — session: ${code}`);

    // ── Firebase listener ────────────────────────────────────────────────────
    const { rtdb } = getFirebase();
    const chunksRef = ref(rtdb, `meetings/${id}/chunks`);
    listenerRef.current = chunksRef;
    console.log(`🔥 [useMeetingSession] Firebase RTDB listener ACTIVE — path: meetings/${id.slice(0, 8)}/chunks`);

    onChildAdded(chunksRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const chunkId = snapshot.key ?? String(Date.now());
      if (seenIdsRef.current.has(chunkId)) {
        console.log(`🔁 [useMeetingSession] Firebase chunk deduped (already via WS) — id: ${chunkId}`);
        return;
      }
      seenIdsRef.current.add(chunkId);
      console.log(`🔥📩 [useMeetingSession] Firebase chunk received — Speaker ${data.speaker}: "${data.text}"`);
      const chunk: TranscriptChunk = {
        id: chunkId,
        speaker: String(data.speaker ?? '0'),
        text: data.text ?? '',
        timestamp: data.timestamp ?? Date.now(),
      };
      setChunks((prev) => [...prev, chunk]);
      setStatus('active');
    });

    // ── WebSocket ────────────────────────────────────────────────────────────
    if (!CAPTURE_WS_URL) {
      console.warn('⚠️ [useMeetingSession] EXPO_PUBLIC_CAPTURE_MEETING_WS_URL not set — WS disabled, Firebase-only mode');
      return;
    }

    console.log(`📡 [useMeetingSession] WS target: ${CAPTURE_WS_URL}`);
    wsActiveRef.current = true;
    wsReconnectAttemptsRef.current = 0;

    function connectWs() {
      if (!wsActiveRef.current) return;
      console.log(`🔌 [useMeetingSession] WS connecting to ${CAPTURE_WS_URL}…`);
      const ws = new WebSocket(CAPTURE_WS_URL);
      wsRef.current = ws;
      let didOpen = false;

      ws.onopen = () => {
        didOpen = true;
        wsReconnectAttemptsRef.current = 0;
        const sessionCode = id.slice(0, 8).toUpperCase();
        ws.send(JSON.stringify({ type: 'phone', sessionCode }));
        console.log(`✅ [useMeetingSession] WS OPEN — sent phone registration for session: ${sessionCode}`);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'registered') {
            console.log(`📱 [useMeetingSession] WS REGISTERED — server confirmed session: ${msg.sessionId?.slice(0, 8)}`);
            console.log(`🟢 [useMeetingSession] Pipeline ACTIVE — phone registered, waiting for extension audio`);
          } else if (msg.type === 'chunk') {
            if (seenIdsRef.current.has(msg.id)) {
              console.log(`🔁 [useMeetingSession] WS chunk deduped (already via Firebase) — id: ${msg.id}`);
              return;
            }
            seenIdsRef.current.add(msg.id);
            console.log(`📩 [useMeetingSession] WS chunk received — Speaker ${msg.speaker}: "${msg.text}"`);
            setChunks((prev) => [...prev, {
              id: msg.id,
              speaker: String(msg.speaker ?? '0'),
              text: msg.text ?? '',
              timestamp: msg.timestamp ?? Date.now(),
            }]);
            setStatus('active');
          } else {
            console.log(`📨 [useMeetingSession] WS message — type: ${msg.type}`);
          }
        } catch {}
      };

      ws.onerror = () => console.warn(`❌ [useMeetingSession] WS connection FAILED — server unreachable at ${CAPTURE_WS_URL}`);

      ws.onclose = (e) => {
        wsRef.current = null;
        if (!wsActiveRef.current) return;
        if (!didOpen) {
          console.warn(`🚫 [useMeetingSession] WS never connected — falling back to Firebase-only mode`);
          return;
        }
        const attempts = wsReconnectAttemptsRef.current;
        if (attempts >= 10) {
          console.warn(`🛑 [useMeetingSession] WS max reconnects (10) reached — Firebase-only mode`);
          return;
        }
        const delay = Math.min(1000 * 2 ** attempts, 30000);
        wsReconnectAttemptsRef.current += 1;
        console.log(`🔄 [useMeetingSession] WS closed (code ${e.code}) — reconnecting in ${delay}ms (attempt ${wsReconnectAttemptsRef.current}/10)`);
        wsReconnectTimerRef.current = setTimeout(connectWs, delay);
      };
    }

    connectWs();
  }, []);

  const stopListening = useCallback(() => {
    console.log(`🛑 [useMeetingSession] Stopping all listeners`);
    wsActiveRef.current = false;
    if (wsReconnectTimerRef.current) {
      clearTimeout(wsReconnectTimerRef.current);
      wsReconnectTimerRef.current = null;
      console.log(`⏹️ [useMeetingSession] WS reconnect timer cleared`);
    }
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
      console.log(`🔥⏹️ [useMeetingSession] Firebase listener detached`);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      console.log(`🔌⏹️ [useMeetingSession] WS closed`);
    }
    seenIdsRef.current.clear();
  }, []);

  const endSession = useCallback(async () => {
    if (!sessionId) return;
    const { rtdb } = getFirebase();
    const metaRef = ref(rtdb, `meetings/${sessionId}/status`);
    await set(metaRef, 'ended');
    stopListening();
    setStatus('ended');
  }, [sessionId, stopListening]);

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  return {
    sessionId,
    status,
    chunks,
    error,
    createSession,
    startListening,
    stopListening,
    endSession,
  };
}

export function assembleTranscript(chunks: TranscriptChunk[]): string {
  if (chunks.length === 0) return '';
  const sorted = [...chunks].sort((a, b) => a.timestamp - b.timestamp);
  const lines: string[] = [];
  let currentSpeaker = '';
  let currentText = '';

  for (const chunk of sorted) {
    if (chunk.speaker !== currentSpeaker) {
      if (currentText) lines.push(`Speaker ${currentSpeaker}: ${currentText.trim()}`);
      currentSpeaker = chunk.speaker;
      currentText = chunk.text + ' ';
    } else {
      currentText += chunk.text + ' ';
    }
  }
  if (currentText) lines.push(`Speaker ${currentSpeaker}: ${currentText.trim()}`);
  return lines.join('\n\n');
}
