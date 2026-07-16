import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Voice, Call } from '@twilio/voice-react-native-sdk';
import { getAuth } from 'firebase/auth';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3001';

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'disconnected';

export interface SalesCall {
  callSid: string | null;
  to: string;
  startedAt: number;
}

const voice = new Voice();

async function fetchToken(): Promise<string> {
  const user = getAuth().currentUser;
  const identity = user?.uid ?? `anon_${Date.now()}`;
  const res = await fetch(`${SERVER_URL}/twilio/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `identity=${encodeURIComponent(identity)}`,
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const { token } = await res.json();
  return token;
}

export function useSalesCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<SalesCall | null>(null);
  const [duration, setDuration] = useState(0);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Pre-fetch token on mount so the first call connects fast
  useEffect(() => {
    fetchToken()
      .then((t) => { tokenRef.current = t; })
      .catch(() => {});

    return () => {
      stopTimer();
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const attachCallListeners = useCallback((call: Call) => {
    callRef.current = call;

    call.on(Call.Event.Connected, () => {
      setCallState('connected');
      setDuration(0);
      startTimer();
    });

    call.on(Call.Event.ConnectFailure, (error) => {
      console.error('[twilio] Connect failure:', error);
      setCallState('idle');
      setActiveCall(null);
      stopTimer();
      Alert.alert('Call failed', error?.message ?? 'Could not connect the call.');
    });

    call.on(Call.Event.Disconnected, () => {
      setCallState('disconnected');
      stopTimer();
      setTimeout(() => {
        setCallState('idle');
        setActiveCall(null);
        setDuration(0);
      }, 1500);
    });

    call.on(Call.Event.Reconnecting, () => {
      setCallState('connecting');
    });

    call.on(Call.Event.Reconnected, () => {
      setCallState('connected');
    });
  }, [startTimer, stopTimer]);

  const placeCall = useCallback(async (phoneNumber: string) => {
    if (callState !== 'idle') return;

    try {
      setCallState('connecting');

      let token = tokenRef.current;
      if (!token) {
        token = await fetchToken();
        tokenRef.current = token;
      }

      await voice.connect(token, {
        params: { To: phoneNumber },
      });

      // Voice SDK fires 'callInviteAccepted' for outbound — listen for the Call object
      voice.once(Voice.Event.CallInviteAccepted, (call: Call) => {
        const sid = call.getSid() ?? null;
        setActiveCall({ callSid: sid, to: phoneNumber, startedAt: Date.now() });
        setCallState('ringing');
        attachCallListeners(call);
      });

    } catch (e: any) {
      console.error('[twilio] placeCall error:', e);
      setCallState('idle');
      Alert.alert('Could not place call', e?.message ?? 'Please try again.');
    }
  }, [callState, attachCallListeners]);

  const hangUp = useCallback(() => {
    callRef.current?.disconnect();
    callRef.current = null;
  }, []);

  const toggleMute = useCallback(async (muted: boolean) => {
    await callRef.current?.mute(muted);
  }, []);

  return { callState, activeCall, duration, placeCall, hangUp, toggleMute };
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
