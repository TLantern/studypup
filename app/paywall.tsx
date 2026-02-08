import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { SuperwallAvailableContext, usePlacementHook } from '@/lib/superwall';

const PLACEMENT_ONBOARDING = 'onboarding_complete';

function PaywallWithSuperwall() {
  const params = useLocalSearchParams<{ placement?: string; return?: string }>();
  const placement = params.placement ?? PLACEMENT_ONBOARDING;
  const shouldReturn = params.return === '1';
  const usePlacement = usePlacementHook!;
  const navigateToMain = useCallback(() => {
    if (shouldReturn) {
      router.back();
    } else {
      router.replace('/create-account');
    }
  }, [shouldReturn]);
  const didPresentRef = useRef(false);

  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      navigateToMain();
    },
    onSkip: () => {
      navigateToMain();
    },
    onError: (err: unknown) => {
      console.error('[Paywall] Superwall onError:', err);
      navigateToMain();
    },
  });

  useEffect(() => {
    if (didPresentRef.current) return;
    didPresentRef.current = true;
    registerPlacement({ placement, feature: navigateToMain })
      .then(() => {})
      .catch(() => {
        navigateToMain();
      });
  }, [placement, navigateToMain, registerPlacement]);

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
