import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { SuperwallAvailableContext, usePlacementHook, useUserHook, PLACEMENT_VALUE_SCREEN } from '@/lib/superwall';
import { trackEvent } from '@/lib/mixpanel';

const PLACEMENT_ONBOARDING = 'onboarding_complete';

function PaywallWithSuperwall() {
  const params = useLocalSearchParams<{ placement?: string; return?: string }>();
  const placement = params.placement ?? PLACEMENT_ONBOARDING;
  const shouldReturn = params.return === '1';
  const usePlacement = usePlacementHook!;
  const useUser = useUserHook!;
  const { subscriptionStatus } = useUser();
  const isPro = subscriptionStatus?.status === 'ACTIVE';
  const navigateToMain = useCallback(() => {
    if (shouldReturn) {
      router.back();
    } else {
      router.replace('/signup');
    }
  }, [shouldReturn]);
  const didPresentRef = useRef(false);

  const phaseRef = useRef<'value' | 'paywall'>('value');

  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        trackEvent('paywall');
        setTimeout(() => registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain()), 600);
      } else {
        navigateToMain();
      }
    },
    onSkip: () => {
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        trackEvent('paywall');
        setTimeout(() => registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain()), 600);
      } else {
        navigateToMain();
      }
    },
    onError: (err: unknown) => {
      console.error('[Paywall] Superwall onError:', err);
      navigateToMain();
    },
  });

  useEffect(() => {
    if (didPresentRef.current) return;
    if (isPro) { didPresentRef.current = true; navigateToMain(); return; }
    didPresentRef.current = true;
    phaseRef.current = 'value';
    trackEvent('value-screen');
    registerPlacement({ placement: PLACEMENT_VALUE_SCREEN, feature: () => {
      phaseRef.current = 'paywall';
      trackEvent('paywall');
      setTimeout(() => registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain()), 600);
    }}).catch(() => navigateToMain());
  }, [placement, navigateToMain, registerPlacement, isPro]);

  return null;
}

const didRedirectRef = { current: false };

function PaywallWithoutSuperwall() {
  useEffect(() => {
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;
    router.replace('/signup');
  }, []);
  return null;
}

export default function PaywallScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  return superwallAvailable ? <PaywallWithSuperwall /> : <PaywallWithoutSuperwall />;
}
