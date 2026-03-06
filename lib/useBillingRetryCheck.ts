import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

let _useUser: typeof import('expo-superwall').useUser | null = null;
try { _useUser = require('expo-superwall').useUser; } catch {}

/**
 * Shows the billing-retry modal once per app session when
 * the Superwall subscription status equals 'billingRetry'.
 * Fires on mount and whenever the app returns to the foreground.
 */
export function useBillingRetryCheck(showModal: () => void) {
  const shownThisSession = useRef(false);
  const showRef = useRef(showModal);
  showRef.current = showModal;

  // _useUser is module-level constant — stable across renders, never violates hook order
  let status: string | undefined;
  if (_useUser) {
    try { status = (_useUser as any)()?.subscriptionStatus?.status; } catch {}
  }

  const statusRef = useRef(status);
  statusRef.current = status;

  function tryShow() {
    if (shownThisSession.current) return;
    if (statusRef.current === 'billingRetry') {
      shownThisSession.current = true;
      showRef.current();
    }
  }

  // Check on mount + whenever status changes
  useEffect(() => { tryShow(); }, [status]);

  // Check whenever app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tryShow();
    });
    return () => sub.remove();
  }, []);
}
