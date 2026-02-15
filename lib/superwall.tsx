import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

let SuperwallProvider: React.ComponentType<any> | null = null;
let usePlacementHook: typeof import('expo-superwall').usePlacement | null = null;

try {
  const sw = require('expo-superwall');
  SuperwallProvider = sw.SuperwallProvider;
  usePlacementHook = sw.usePlacement;
  console.log('[Superwall] Native module loaded successfully');
  console.log('[Superwall] SuperwallProvider available:', !!SuperwallProvider);
  console.log('[Superwall] usePlacementHook available:', !!usePlacementHook);
} catch (err) {
  console.warn('[Superwall] Native module not available (Expo Go or build issue):', err);
}

export const SuperwallAvailableContext = createContext(!!SuperwallProvider);
export { SuperwallProvider, usePlacementHook };

/** Superwall placement for paywall on app open (when user is unsubscribed). Create this placement in Superwall dashboard and attach your paywall. */
export const PLACEMENT_APP_OPEN = 'app_open';
/** Superwall placement for "Get Unlimited Notes" button. Create in Superwall if not already. */
export const PLACEMENT_GET_UNLIMITED = 'get_unlimited';
/** Shown when unsubscribed user taps Generate after using their one free generation. */
export const PLACEMENT_GENERATE = 'generate';

type PaywallTriggerContextValue = { showPaywall: (placement: string) => void };
export const PaywallTriggerContext = createContext<PaywallTriggerContextValue>({ showPaywall: () => {} });

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

export const PaywallTriggerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [placementToShow, setPlacementToShow] = useState<string | null>(null);
  const value = useMemo(() => ({ showPaywall: setPlacementToShow }), []);
  
  useEffect(() => {
    if (placementToShow) {
      console.log('[Superwall] PaywallTriggerProvider placementToShow changed to:', placementToShow);
      console.log('[Superwall] usePlacementHook available?', !!usePlacementHook);
    }
  }, [placementToShow]);
  
  return (
    <PaywallTriggerContext.Provider value={value}>
      {children}
      {usePlacementHook != null ? (
        <PaywallTriggerInner placementToShow={placementToShow} onClear={() => setPlacementToShow(null)} />
      ) : (
        placementToShow && console.warn('[Superwall] usePlacementHook is null, cannot show paywall for:', placementToShow)
      )}
    </PaywallTriggerContext.Provider>
  );
};
