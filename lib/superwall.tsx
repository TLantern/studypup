import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { trackPageViewed } from '@/lib/analytics';

let SuperwallProvider: React.ComponentType<any> | null = null;
let usePlacementHook: typeof import('expo-superwall').usePlacement | null = null;
let _useUser: typeof import('expo-superwall').useUser | null = null;
let useSuperwallEventsHook: typeof import('expo-superwall').useSuperwallEvents | null = null;
let _superwallModule: { dismiss: () => Promise<void> } | null = null;

/** Set to true before programmatically dismissing a paywall for transac_abandon. paywall.tsx checks this to skip navigation. */
export const transacAbandonPendingRef = { current: false };
/** Set by paywall.tsx so TransactionAbandonWatcher can re-show the main paywall after transac_abandon closes. */
export const retriggerMainPaywallRef: { current: (() => void) | null } = { current: null };

try {
  const sw = require('expo-superwall');
  SuperwallProvider = sw.SuperwallProvider;
  usePlacementHook = sw.usePlacement;
  _useUser = sw.useUser ?? null;
  useSuperwallEventsHook = sw.useSuperwallEvents ?? null;
  _superwallModule = sw.SuperwallExpoModule ?? null;
  console.log('[Superwall] Native module loaded successfully');
  console.log('[Superwall] SuperwallProvider available:', !!SuperwallProvider);
  console.log('[Superwall] usePlacementHook available:', !!usePlacementHook);
} catch (err) {
  console.warn('[Superwall] Native module not available (Expo Go or build issue):', err);
}

export const SuperwallAvailableContext = createContext(!!SuperwallProvider);
export { SuperwallProvider, usePlacementHook };

/** Returns 'active' | 'inactive' | 'billingRetry' | 'unknown' | null (null = Superwall unavailable). */
export function useSubscriptionStatus(): string | null {
  if (!_useUser) return null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return (_useUser as any)()?.subscriptionStatus?.status ?? null;
  } catch {
    return null;
  }
}

export const PLACEMENT_VALUE_SCREEN = 'value_screen';
/** Onboarding finish flow (matches paywall / Superwall dashboard). */
export const PLACEMENT_ONBOARDING_COMPLETE = 'onboarding_complete';
/** Superwall placement for paywall on app open (when user is unsubscribed). Create this placement in Superwall dashboard and attach your paywall. */
export const PLACEMENT_APP_OPEN = 'app_open';
/** Superwall placement for "Get Unlimited Notes" button. Create in Superwall if not already. */
export const PLACEMENT_GET_UNLIMITED = 'get_unlimited';
/** Shown when unsubscribed user taps Generate after using their one free generation. */
export const PLACEMENT_GENERATE = 'generate';

type PaywallTriggerContextValue = { showPaywall: (placement: string) => void };
export const PaywallTriggerContext = createContext<PaywallTriggerContextValue>({ showPaywall: () => {} });

/** Fires value_screen placement; on feature callback calls onFeature to proceed to actual paywall. */
function ValueScreenInner({
  active,
  onFeature,
  onClear,
}: {
  active: boolean;
  onFeature: () => void;
  onClear: () => void;
}) {
  const usePlacement = usePlacementHook!;
  const didRegisterRef = useRef(false);
  const onFeatureRef = useRef(onFeature);
  const onClearRef = useRef(onClear);
  onFeatureRef.current = onFeature;
  onClearRef.current = onClear;

  const proceed = () => { didRegisterRef.current = false; setTimeout(() => onFeatureRef.current(), 600); };

  const { registerPlacement } = usePlacement({
    onDismiss: proceed,
    onSkip: proceed,
    onError: () => { didRegisterRef.current = false; onClearRef.current(); },
  });

  useEffect(() => {
    if (!active || didRegisterRef.current) return;
    didRegisterRef.current = true;
    registerPlacement({ placement: PLACEMENT_VALUE_SCREEN, feature: proceed })
      .catch(() => { didRegisterRef.current = false; onClearRef.current(); });
  }, [active, registerPlacement]);

  return null;
}

function PaywallTriggerInner({
  placementToShow,
  onClear,
}: {
  placementToShow: string | null;
  onClear: () => void;
}) {
  const usePlacement = usePlacementHook!;
  const { registerPlacement, state } = usePlacement({
    onPresent: (paywallInfo) => {
      console.log('[Superwall] Paywall PRESENTED!', paywallInfo);
    },
    onDismiss: (paywallInfo, result) => {
      console.log('[Superwall] Paywall dismissed:', result);
      onClear();
    },
    onSkip: (reason) => {
      console.log('[Superwall] Paywall SKIPPED:', reason);
      onClear();
    },
    onError: (error) => {
      console.error('[Superwall] Paywall error:', error);
      onClear();
    },
  });

  useEffect(() => {
    if (state.status !== 'idle') {
      console.log('[Superwall] State changed to:', state);
    }
  }, [state]);
  useEffect(() => {
    if (!placementToShow) return;
    trackPageViewed('superwall_placement', { placement: placementToShow });
    console.log('[Superwall] registerPlacement called with:', placementToShow);
    registerPlacement({ placement: placementToShow, feature: () => {} })
      .then(() => {
        console.log('[Superwall] registerPlacement success for:', placementToShow);
        onClear();
      })
      .catch((error) => {
        console.error('[Superwall] registerPlacement failed for:', placementToShow, error);
        onClear();
      });
  }, [placementToShow]);
  return null;
}

const hasSeenTransacAbandon = { current: false };

function TransactionAbandonWatcher() {
  const usePlacement = usePlacementHook!;
  const useSuperwallEvents = useSuperwallEventsHook!;
  const activeRef = useRef<'abandon' | null>(null);

  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[TransacAbandon] onPresent — paywall presented:', info?.name);
    },
    onError: (error) => {
      console.error('[TransacAbandon] onError:', error);
      transacAbandonPendingRef.current = false;
      activeRef.current = null;
    },
    onDismiss: () => {
      console.log('[TransacAbandon] onDismiss — activeRef:', activeRef.current);
      if (activeRef.current === 'abandon') {
        activeRef.current = null;
        hasSeenTransacAbandon.current = true;
        console.log('[TransacAbandon] transac_abandon dismissed → retrigger onboarding_complete in 600ms');
        setTimeout(() => {
          transacAbandonPendingRef.current = false;
          console.log('[TransacAbandon] calling retriggerMainPaywallRef');
          retriggerMainPaywallRef.current?.();
        }, 600);
      }
    },
    onSkip: (reason) => {
      console.log('[TransacAbandon] onSkip — activeRef:', activeRef.current, '| reason:', JSON.stringify(reason));
      if (activeRef.current === 'abandon') {
        activeRef.current = null;
        hasSeenTransacAbandon.current = true;
        console.log('[TransacAbandon] transac_abandon skipped → retrigger onboarding_complete in 600ms');
        setTimeout(() => {
          transacAbandonPendingRef.current = false;
          console.log('[TransacAbandon] calling retriggerMainPaywallRef');
          retriggerMainPaywallRef.current?.();
        }, 600);
      }
    },
  });

  useSuperwallEvents({
    onSuperwallEvent: (eventInfo) => {
      const ev = eventInfo.event;
      if (ev.event !== 'transactionAbandon') return;
      const triggeredBy = (ev as any).paywallInfo?.presentedByEventWithName;
      console.log('[TransacAbandon] transactionAbandon fired — triggeredBy:', triggeredBy,
        '| hasSeenOffer:', hasSeenTransacAbandon.current);
      if (!hasSeenTransacAbandon.current && triggeredBy !== PLACEMENT_VALUE_SCREEN) {
        console.log('[TransacAbandon] proceeding → dismiss + show transac_abandon');
        transacAbandonPendingRef.current = true;
        _superwallModule?.dismiss()
          .then(() => {
            console.log('[TransacAbandon] dismiss() resolved → registering transac_abandon in 400ms');
            setTimeout(() => {
              // Pre-check: see what Superwall would decide before registering
              _superwallModule && (_superwallModule as any).getPresentationResult?.('transac_abandon', null)
                .then((r: any) => console.log('[TransacAbandon] getPresentationResult:', JSON.stringify(r)))
                .catch(() => {});
              activeRef.current = 'abandon';
              registerPlacement({ placement: 'transac_abandon', feature: () => {} }).catch((err) => {
                console.error('[TransacAbandon] registerPlacement transac_abandon failed:', err);
                transacAbandonPendingRef.current = false;
                activeRef.current = null;
                retriggerMainPaywallRef.current?.();
              });
            }, 400);
          })
          .catch((err) => {
            console.error('[TransacAbandon] dismiss() failed:', err);
            transacAbandonPendingRef.current = false;
          });
      }
    },
  });
  return null;
}

export const PaywallTriggerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingPlacement, setPendingPlacement] = useState<string | null>(null);
  const [placementToShow, setPlacementToShow] = useState<string | null>(null);

  const showPaywall = useMemo(() => (placement: string) => {
    setPendingPlacement(placement);
  }, []);

  const value = useMemo(() => ({ showPaywall }), [showPaywall]);

  useEffect(() => {
    if (placementToShow) {
      console.log('[Superwall] PaywallTriggerProvider placementToShow changed to:', placementToShow);
      console.log('[Superwall] usePlacementHook available?', !!usePlacementHook);
    }
  }, [placementToShow]);

  return (
    <PaywallTriggerContext.Provider value={value}>
      {children}
      {usePlacementHook != null && useSuperwallEventsHook != null && (
        <TransactionAbandonWatcher />
      )}
      {usePlacementHook != null && (
        <ValueScreenInner
          active={!!pendingPlacement}
          onFeature={() => {
            const p = pendingPlacement;
            setPendingPlacement(null);
            setPlacementToShow(p);
          }}
          onClear={() => setPendingPlacement(null)}
        />
      )}
      {usePlacementHook != null ? (
        <PaywallTriggerInner placementToShow={placementToShow} onClear={() => setPlacementToShow(null)} />
      ) : (
        (placementToShow ? (console.warn('[Superwall] usePlacementHook is null, cannot show paywall for:', placementToShow), null) : null)
      )}
    </PaywallTriggerContext.Provider>
  );
};
