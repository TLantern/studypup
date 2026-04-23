import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SuperwallAvailableContext, usePlacementHook, PLACEMENT_VALUE_SCREEN, transacAbandonPendingRef, retriggerMainPaywallRef, useSubscriptionStatus } from '@/lib/superwall';
import { MeshGradientBackground } from '@/components/MeshGradientBackground';
import { trackPageViewed } from '@/lib/analytics';
import { ttTrackStartTrial } from '@/lib/tiktok-analytics';
import { getItem } from '@/lib/storage';

const PLACEMENT_ONBOARDING = 'onboarding_complete';

function PaywallWithSuperwall() {
  const params = useLocalSearchParams<{ placement?: string; return?: string }>();
  const placement = params.placement ?? PLACEMENT_ONBOARDING;
  const shouldReturn = params.return === '1';
  const usePlacement = usePlacementHook!;
  const subscriptionStatus = useSubscriptionStatus();
  const subscriptionStatusRef = useRef(subscriptionStatus);
  subscriptionStatusRef.current = subscriptionStatus;

  const navigateToMain = useCallback(() => {
    if (transacAbandonPendingRef.current) {
      console.log('[Paywall] navigateToMain suppressed — transac_abandon pending');
      return;
    }
    if (shouldReturn) {
      router.back();
    } else {
      router.replace('/create-account');
    }
  }, [shouldReturn]);

  const didPresentRef = useRef(false);
  const phaseRef = useRef<'value' | 'paywall'>('value');
  const mainPaywallRegisteredRef = useRef(false);

  const trackPlacementViewed = useCallback((placementName: string) => {
    trackPageViewed(placementName === PLACEMENT_VALUE_SCREEN ? 'value_screen' : 'onboarding_complete_placement', {
      placement: placementName,
      shouldReturn,
    });
  }, [shouldReturn]);

  // Only navigateToMain via this ref — ensures purchase/subscription confirmed before exiting
  const retryPaywallRef = useRef<() => void>(() => {
    console.warn('[Paywall] retryPaywall called before initialized');
  });

  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Paywall] onPresent:', info?.name, '| phase:', phaseRef.current);
    },
    onDismiss: () => {
      console.log('[Paywall] onDismiss — phase:', phaseRef.current, '| transacPending:', transacAbandonPendingRef.current);
      if (transacAbandonPendingRef.current) { console.log('[Paywall] onDismiss suppressed for transac_abandon'); return; }
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        if (mainPaywallRegisteredRef.current) { return; }
        mainPaywallRegisteredRef.current = true;
        console.log('[Paywall] value dismissed → registering', placement, 'in 600ms');
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({ placement, feature: () => { console.log('[Paywall] purchased →', placement); ttTrackStartTrial(); navigateToMain(); } })
            .catch(() => retryPaywallRef.current());
        }, 600);
      } else {
        console.log('[Paywall] paywall dismissed without purchase → re-showing');
        retryPaywallRef.current();
      }
    },
    onSkip: (reason) => {
      console.log('[Paywall] onSkip — phase:', phaseRef.current, '| transacPending:', transacAbandonPendingRef.current, '| reason:', JSON.stringify(reason));
      if (transacAbandonPendingRef.current) { return; }
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        console.log('[Paywall] value skipped → registering', placement, 'in 600ms');
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({ placement, feature: () => { console.log('[Paywall] purchased (skip path) →', placement); ttTrackStartTrial(); navigateToMain(); } })
            .catch(() => retryPaywallRef.current());
        }, 600);
      } else {
        // Only exit if Superwall confirmed subscription; otherwise stay on paywall
        if (subscriptionStatusRef.current === 'active') {
          console.log('[Paywall] paywall skipped — user subscribed → navigateToMain');
          navigateToMain();
        } else {
          console.log('[Paywall] paywall skipped (not subscribed) → re-showing');
          retryPaywallRef.current();
        }
      }
    },
    onError: (err: unknown) => {
      console.error('[Paywall] Superwall onError — retrying:', err);
      retryPaywallRef.current();
    },
  });

  // Keep retryPaywallRef always fresh so callbacks never use stale registerPlacement
  useEffect(() => {
    retryPaywallRef.current = () => {
      console.log('[Paywall] retryPaywall → re-showing', placement);
      phaseRef.current = 'paywall';
      mainPaywallRegisteredRef.current = false;
      setTimeout(() => {
        mainPaywallRegisteredRef.current = true;
        trackPlacementViewed(placement);
        registerPlacement({ placement, feature: () => { console.log('[Paywall] purchased (retry) →', placement); ttTrackStartTrial(); navigateToMain(); } })
          .catch(() => {
            console.warn('[Paywall] retryPaywall: registerPlacement failed — retrying in 2s');
            mainPaywallRegisteredRef.current = false;
            setTimeout(() => retryPaywallRef.current(), 2000);
          });
      }, 600);
    };
  }, [placement, navigateToMain, registerPlacement, trackPlacementViewed]);

  useEffect(() => {
    retriggerMainPaywallRef.current = () => {
      console.log('[Paywall] retriggerMainPaywallRef → re-showing', placement);
      retryPaywallRef.current();
    };
    return () => { retriggerMainPaywallRef.current = null; };
  }, [placement]);

  useEffect(() => {
    try {
      const sw = require('expo-superwall');
      sw.SuperwallExpoModule?.getSubscriptionStatus?.().then((s: any) => {
        console.log('[Paywall] subscriptionStatus on mount:', JSON.stringify(s));
      }).catch((e: any) => console.warn('[Paywall] getSubscriptionStatus error:', e));
    } catch {}
  }, []);

  useEffect(() => {
    trackPageViewed('paywall', { placement, shouldReturn });
    if (didPresentRef.current) return;
    getItem('dev:reviewer').then((isDev) => {
      if (isDev) { ttTrackStartTrial(); navigateToMain(); return; }
      didPresentRef.current = true;
      phaseRef.current = 'value';
      trackPlacementViewed(PLACEMENT_VALUE_SCREEN);
      registerPlacement({ placement: PLACEMENT_VALUE_SCREEN, feature: () => {
        console.log('[Paywall] value_screen feature → registering', placement, 'in 600ms');
        phaseRef.current = 'paywall';
        if (mainPaywallRegisteredRef.current) { return; }
        mainPaywallRegisteredRef.current = true;
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({ placement, feature: () => { console.log('[Paywall] purchased (value_screen path) →', placement); ttTrackStartTrial(); navigateToMain(); } })
            .catch(() => retryPaywallRef.current());
        }, 600);
      }}).catch(() => {
        // value_screen failed — jump directly to main paywall
        console.warn('[Paywall] value_screen failed → jumping to main paywall');
        phaseRef.current = 'paywall';
        setTimeout(() => retryPaywallRef.current(), 600);
      });
    });
  }, [placement, navigateToMain, registerPlacement, shouldReturn, trackPlacementViewed]);

  return <View style={StyleSheet.absoluteFill}><MeshGradientBackground /></View>;
}

const didRedirectRef = { current: false };

function PaywallWithoutSuperwall() {
  useEffect(() => {
    trackPageViewed('paywall');
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;
    router.replace('/create-account');
  }, []);
  return <View style={StyleSheet.absoluteFill}><MeshGradientBackground /></View>;
}

export default function PaywallScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  return superwallAvailable ? <PaywallWithSuperwall /> : <PaywallWithoutSuperwall />;
}
