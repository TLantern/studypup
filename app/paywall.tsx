import { router } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { SuperwallAvailableContext, usePlacementHook } from '@/lib/superwall';

// Superwall in-app event (placement) configured to show: "Studypup paywall"
const PLACEMENT = 'onboarding_complete';

function PaywallWithSuperwall() {
  const usePlacement = usePlacementHook!;
  const navigateToMain = useCallback(() => {
    console.log('[Paywall] Navigating to create-account');
    router.replace('/create-account');
  }, []);
  const didPresentRef = useRef(false);

  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      console.log('[Paywall] Superwall onDismiss called');
      navigateToMain();
    },
    onSkip: () => {
      console.log('[Paywall] Superwall onSkip called');
      navigateToMain();
    },
    onError: (err: unknown) => {
      console.error('[Paywall] Superwall onError:', err);
      navigateToMain();
    },
  });

  useEffect(() => {
    console.log('[Paywall] PaywallWithSuperwall mounted');
    console.log('[Paywall] Placement name:', PLACEMENT);
    console.log('[Paywall] registerPlacement available:', typeof registerPlacement === 'function');
    
    if (didPresentRef.current) {
      console.log('[Paywall] Already attempted to present, skipping');
      return;
    }
    
    didPresentRef.current = true;
    console.log('[Paywall] Calling registerPlacement with placement:', PLACEMENT);
    
    registerPlacement({ placement: PLACEMENT, feature: navigateToMain })
      .then(() => {
        console.log('[Paywall] registerPlacement resolved successfully');
      })
      .catch((err: unknown) => {
        console.error('[Paywall] registerPlacement rejected:', err);
        navigateToMain();
      });
  }, [navigateToMain, registerPlacement]);

  return null;
}

function PaywallWithoutSuperwall() {
  useEffect(() => {
    console.log('[Paywall] Superwall not available, redirecting to create-account');
    router.replace('/create-account');
  }, []);
  return null;
}

export default function PaywallScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  console.log('[Paywall] PaywallScreen mounted, superwallAvailable:', superwallAvailable);
  return superwallAvailable ? <PaywallWithSuperwall /> : <PaywallWithoutSuperwall />;
}
