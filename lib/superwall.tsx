import React, { createContext, useEffect, useMemo, useRef, useState } from 'react';

let SuperwallProvider: React.ComponentType<any> | null = null;
let usePlacementHook: typeof import('expo-superwall').usePlacement | null = null;
let useUserHook: typeof import('expo-superwall').useUser | null = null;

try {
  const sw = require('expo-superwall');
  SuperwallProvider = sw.SuperwallProvider;
  usePlacementHook = sw.usePlacement;
  useUserHook = sw.useUser;
  console.log('[Superwall] Native module loaded successfully');
  console.log('[Superwall] SuperwallProvider available:', !!SuperwallProvider);
  console.log('[Superwall] usePlacementHook available:', !!usePlacementHook);
} catch (err) {
  console.warn('[Superwall] Native module not available (Expo Go or build issue):', err);
}

const useUserStub = () => ({ subscriptionStatus: { status: 'INACTIVE' as const } });
const useUserSafe = useUserHook ?? useUserStub;

export const SuperwallAvailableContext = createContext(!!SuperwallProvider);
export { SuperwallProvider, usePlacementHook, useUserHook, useUserSafe };

export const PLACEMENT_VALUE_SCREEN = 'value_screen';
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
  const useUser = useUserHook!;
  const { subscriptionStatus } = useUser();
  const isSubscribed = subscriptionStatus?.status === 'ACTIVE';
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
    if (isSubscribed) { onClearRef.current(); return; }
    didRegisterRef.current = true;
    registerPlacement({ placement: PLACEMENT_VALUE_SCREEN, feature: proceed })
      .catch(() => { didRegisterRef.current = false; onClearRef.current(); });
  }, [active, isSubscribed, registerPlacement]);

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
  const useUser = useUserHook!;
  const { subscriptionStatus } = useUser();
  const isPro = subscriptionStatus?.status === 'ACTIVE';

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
    if (isPro) { onClear(); return; }
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
  }, [placementToShow, isPro, onClear]);
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
        placementToShow && console.warn('[Superwall] usePlacementHook is null, cannot show paywall for:', placementToShow)
      )}
    </PaywallTriggerContext.Provider>
  );
};
