import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteTrack, VideoTrack } from 'livekit-client';

const LIVEAVATAR_API = 'https://api.liveavatar.com/v1';
const API_KEY = process.env.EXPO_PUBLIC_HEYGEN_LIVEAVATAR_API_KEY ?? '';
const AVATAR_ID = process.env.EXPO_PUBLIC_HEYGEN_AVATAR_ID ?? '';

export type SessionState = 'idle' | 'connecting' | 'ready' | 'speaking' | 'listening' | 'error';

export type UseLiveAvatarSessionResult = {
  sessionState: SessionState;
  videoTrack: VideoTrack | null;
  connect: () => Promise<void>;
  streamAudioChunk: (pcmBase64: string) => void;
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

  const connect = useCallback(async () => {
    if (sessionState === 'connecting' || sessionState === 'ready') return;
    setSessionState('connecting');
    setError(null);

    try {
      // Step 1: Get session token
      const tokenRes = await fetch(`${LIVEAVATAR_API}/sessions/token`, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'LITE', avatar_id: AVATAR_ID }),
      });
      if (!tokenRes.ok) throw new Error(`Token error ${tokenRes.status}`);
      const tokenData = await tokenRes.json();
      const sessionToken: string = tokenData.data.session_token;
      sessionIdRef.current = tokenData.data.session_id;

      // Step 2: Start session — get LiveKit + WebSocket credentials
      const startRes = await fetch(`${LIVEAVATAR_API}/sessions/start`, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      });
      if (!startRes.ok) throw new Error(`Start error ${startRes.status}`);
      const startData = await startRes.json();
      const { ws_url, livekit_token, livekit_url } = startData.data;

      // Step 3: Connect LiveKit room for video stream
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          setVideoTrack(track as unknown as VideoTrack);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          setVideoTrack(null);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        setSessionState('idle');
        setVideoTrack(null);
      });

      await room.connect(livekit_url, livekit_token);

      // Step 4: Open WebSocket for audio streaming
      const ws = new WebSocket(ws_url);
      wsRef.current = ws;
      ws.onopen = () => setSessionState('ready');
      ws.onerror = (e) => {
        setError('WebSocket error');
        setSessionState('error');
      };
    } catch (e: any) {
      setError(e.message ?? 'Connection failed');
      setSessionState('error');
    }
  }, [sessionState]);

  // Send a PCM base64 audio chunk to LiveAvatar for lip-sync rendering
  const streamAudioChunk = useCallback((pcmBase64: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'audio', audio: pcmBase64 }));
    setSessionState('speaking');
  }, []);

  // Tell the avatar to stop speaking immediately
  const interrupt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'interrupt' }));
    setSessionState('listening');
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
    setVideoTrack(null);
    setSessionState('idle');
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      roomRef.current?.disconnect();
    };
  }, []);

  return { sessionState, videoTrack, connect, streamAudioChunk, interrupt, disconnect, error };
}
