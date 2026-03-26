import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { SuperwallAvailableContext, usePlacementHook, PLACEMENT_VALUE_SCREEN } from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';

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

  const phaseRef = useRef<'value' | 'paywall'>('value');
  const trackPlacementViewed = useCallback((placementName: string) => {
    trackPageViewed(placementName === PLACEMENT_VALUE_SCREEN ? 'value_screen' : 'onboarding_complete_placement', {
      placement: placementName,
      shouldReturn,
    });
  }, [shouldReturn]);

  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain());
        }, 600);
      } else {
        navigateToMain();
      }
    },
    onSkip: () => {
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain());
        }, 600);
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
    trackPageViewed('paywall', { placement, shouldReturn });
    if (didPresentRef.current) return;
    didPresentRef.current = true;
    phaseRef.current = 'value';
    trackPlacementViewed(PLACEMENT_VALUE_SCREEN);
    registerPlacement({ placement: PLACEMENT_VALUE_SCREEN, feature: () => {
      phaseRef.current = 'paywall';
      setTimeout(() => {
        trackPlacementViewed(placement);
        registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain());
      }, 600);
    }}).catch(() => navigateToMain());
  }, [placement, navigateToMain, registerPlacement, shouldReturn, trackPlacementViewed]);

  return null;
}

const didRedirectRef = { current: false };

function PaywallWithoutSuperwall() {
  useEffect(() => {
    trackPageViewed('paywall');
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;
    router.replace('/create-account');
  }, []);
  return null;
}

export default function PaywallScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  return superwallAvailable ? <PaywallWithSuperwall /> : <PaywallWithoutSuperwall />;
}
