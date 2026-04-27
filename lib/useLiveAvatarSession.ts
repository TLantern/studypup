import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteTrack, VideoTrack } from 'livekit-client';

const LIVEAVATAR_API = 'https://api.liveavatar.com';
const API_KEY = process.env.EXPO_PUBLIC_HEYGEN_LIVEAVATAR_API_KEY ?? '';
const AVATAR_ID = process.env.EXPO_PUBLIC_HEYGEN_AVATAR_ID ?? '';

export type SessionState = 'idle' | 'connecting' | 'ready' | 'speaking' | 'listening' | 'error';

export type UseLiveAvatarSessionResult = {
  sessionState: SessionState;
  videoTrack: VideoTrack | null;
  connect: () => Promise<void>;
  streamAudioChunk: (pcmBase64: string) => void;
  streamAudioEnd: (eventId: string, audioDurationMs?: number) => Promise<void>;
  interrupt: () => void;
  disconnect: () => void;
  error: string | null;
};

export function useLiveAvatarSession(): UseLiveAvatarSessionResult {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [videoTrack, setVideoTrack] = useState<VideoTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Keyed by eventId → resolve callback for agent.speak_ended
  const speakEndCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const sessionReadyResolveRef = useRef<(() => void) | null>(null);

  const connect = useCallback(async () => {
    if (sessionState === 'connecting' || sessionState === 'ready') return;
    setSessionState('connecting');
    setError(null);

    try {
      // Step 1: Create session token (LITE mode)
      console.log('[LiveAvatar] ENV CHECK:', {
        API_KEY_raw: JSON.stringify(process.env.EXPO_PUBLIC_HEYGEN_LIVEAVATAR_API_KEY),
        AVATAR_ID_raw: JSON.stringify(process.env.EXPO_PUBLIC_HEYGEN_AVATAR_ID),
        API_KEY_len: API_KEY.length,
        AVATAR_ID_len: AVATAR_ID.length,
        API_KEY_full: API_KEY,
      });
      const tokenRes = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'LITE', avatar_id: AVATAR_ID }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => '');
        console.error('[LiveAvatar] create token failed:', tokenRes.status, body);
        throw new Error(`Token error ${tokenRes.status}: ${body}`);
      }
      const tokenData = await tokenRes.json();
      const sessionToken: string = tokenData.data.session_token;
      sessionIdRef.current = tokenData.data.session_id;
      console.log('[LiveAvatar] Got session token, sessionId:', sessionIdRef.current);

      // Step 2: Start session — token goes in Authorization header, not body
      console.log('[LiveAvatar] Starting session...');
      const startRes = await fetch(`${LIVEAVATAR_API}/v1/sessions/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!startRes.ok) {
        const body = await startRes.text().catch(() => '');
        console.error('[LiveAvatar] start session failed:', startRes.status, body);
        throw new Error(`Start error ${startRes.status}: ${body}`);
      }
      const startData = await startRes.json();
      const { livekit_url, livekit_client_token, ws_url } = startData.data;
      console.log('[LiveAvatar] Session started, livekit_url:', livekit_url, 'ws_url:', ws_url);

      // Step 3: Connect LiveKit room for video stream
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          console.log('[LiveAvatar] Video track subscribed');
          setVideoTrack(track as unknown as VideoTrack);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          console.log('[LiveAvatar] Video track unsubscribed');
          setVideoTrack(null);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        console.log('[LiveAvatar] LiveKit room disconnected');
        setSessionState('idle');
        setVideoTrack(null);
      });

      console.log('[LiveAvatar] Connecting LiveKit room...');
      await room.connect(livekit_url, livekit_client_token);
      console.log('[LiveAvatar] LiveKit room connected');

      // Step 4: Open WebSocket for LITE mode control, wait for session.state_updated=connected
      console.log('[LiveAvatar] Opening control WebSocket...');
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(ws_url);
        wsRef.current = ws;
        sessionReadyResolveRef.current = resolve;

        const timeout = setTimeout(() => {
          reject(new Error('WebSocket session ready timeout'));
        }, 20000);

        ws.onopen = () => {
          console.log('[LiveAvatar] WebSocket open — waiting for session.state_updated=connected');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string);
            const SILENT = new Set(['agent.audio_buffer_appended']);
            if (!SILENT.has(msg.type)) {
              console.log('[LiveAvatar] WS event FULL:', JSON.stringify(msg));
            }

            if (msg.type === 'session.state_updated' && msg.state === 'connected') {
              console.log('[LiveAvatar] Session connected and ready');
              clearTimeout(timeout);
              sessionReadyResolveRef.current?.();
              sessionReadyResolveRef.current = null;
            }

            // Listen for all plausible "avatar finished speaking" events
            const speakDoneTypes = [
              'agent.speak_ended',
              'agent.speaking_stopped',
              'agent.audio_buffer_played',
              'agent.response_done',
            ];
            if (speakDoneTypes.includes(msg.type)) {
              const eventId: string = msg.event_id ?? '';
              console.log('[LiveAvatar] speak-done event:', msg.type, 'eventId:', eventId);
              const cb =
                speakEndCallbacksRef.current.get(eventId) ??
                speakEndCallbacksRef.current.values().next().value;
              if (cb) {
                speakEndCallbacksRef.current.delete(eventId);
                cb();
              }
            }
          } catch {}
        };

        ws.onerror = (e) => {
          console.error('[LiveAvatar] WebSocket error:', e);
          clearTimeout(timeout);
          reject(new Error('WebSocket error'));
        };

        ws.onclose = (e) => {
          console.log('[LiveAvatar] WebSocket closed, code:', e.code);
          if (sessionReadyResolveRef.current) {
            clearTimeout(timeout);
            reject(new Error('WebSocket closed before ready'));
            sessionReadyResolveRef.current = null;
          }
        };
      });

      setSessionState('ready');
    } catch (e: any) {
      console.error('[LiveAvatar] connect() failed:', e.message);
      setError(e.message ?? 'Connection failed');
      setSessionState('error');
      throw e;
    }
  }, [sessionState]);

  // Send one PCM-24kHz base64 chunk to the avatar
  const streamAudioChunk = useCallback((pcmBase64: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'agent.speak', audio: pcmBase64 }));
  }, []);

  // Signal end of a speaking turn — resolves when avatar.speak_ended fires (or timeout)
  // Pass audioDurationMs so the timeout is always longer than the clip length
  const streamAudioEnd = useCallback((eventId: string, audioDurationMs = 0): Promise<void> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve();

    console.log('[LiveAvatar] Sending agent.speak_end, eventId:', eventId);
    ws.send(JSON.stringify({ type: 'agent.speak_end', event_id: eventId }));

    // Give at least 8 s, or audio duration + 6 s buffer, whichever is larger
    const timeoutMs = Math.max(8000, audioDurationMs + 6000);

    return new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn('[LiveAvatar] speak_end timeout — resolving anyway');
        speakEndCallbacksRef.current.delete(eventId);
        resolve();
      }, timeoutMs);

      speakEndCallbacksRef.current.set(eventId, () => {
        clearTimeout(timeoutId);
        resolve();
      });
    });
  }, []);

  const interrupt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    console.log('[LiveAvatar] Sending agent.interrupt');
    ws.send(JSON.stringify({ type: 'agent.interrupt' }));
    // Resolve any pending speak_end waits immediately
    speakEndCallbacksRef.current.forEach((cb) => cb());
    speakEndCallbacksRef.current.clear();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
    speakEndCallbacksRef.current.forEach((cb) => cb());
    speakEndCallbacksRef.current.clear();
    setVideoTrack(null);
    setSessionState('idle');
    console.log('[LiveAvatar] Disconnected');
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      roomRef.current?.disconnect();
    };
  }, []);

  return { sessionState, videoTrack, connect, streamAudioChunk, streamAudioEnd, interrupt, disconnect, error };
}
