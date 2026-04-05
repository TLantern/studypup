import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SuperwallAvailableContext, usePlacementHook, PLACEMENT_VALUE_SCREEN, transacAbandonPendingRef, retriggerMainPaywallRef, useSubscriptionStatus } from '@/lib/superwall';
import { MeshGradientBackground } from '@/components/MeshGradientBackground';
import { trackPageViewed } from '@/lib/analytics';
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

  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Paywall] onPresent — paywall presented:', info?.name, '| phase:', phaseRef.current);
    },
    onDismiss: () => {
      console.log('[Paywall] onDismiss — phase:', phaseRef.current, '| transacPending:', transacAbandonPendingRef.current);
      if (transacAbandonPendingRef.current) { console.log('[Paywall] onDismiss suppressed for transac_abandon'); return; }
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        if (mainPaywallRegisteredRef.current) { console.log('[Paywall] onDismiss: main paywall already registered, skipping'); return; }
        mainPaywallRegisteredRef.current = true;
        console.log('[Paywall] value dismissed → registering', placement, 'in 600ms');
        setTimeout(() => {
          trackPlacementViewed(placement);
          console.log('[Paywall] registering', placement, 'now');
          registerPlacement({ placement, feature: () => { console.log('[Paywall] feature granted for', placement, '— purchased → navigateToMain'); navigateToMain(); } }).catch(() => navigateToMain());
        }, 600);
      } else {
        // User closed paywall without purchasing — re-show it after a short delay
        console.log('[Paywall] paywall dismissed without purchase → re-showing in 600ms');
        mainPaywallRegisteredRef.current = false;
        setTimeout(() => {
          trackPlacementViewed(placement);
          mainPaywallRegisteredRef.current = true;
          registerPlacement({ placement, feature: () => { console.log('[Paywall] feature granted for', placement, '(re-show) → navigateToMain'); navigateToMain(); } }).catch(() => navigateToMain());
        }, 600);
      }
    },
    onSkip: (reason) => {
      console.log('[Paywall] onSkip — phase:', phaseRef.current, '| transacPending:', transacAbandonPendingRef.current, '| reason:', JSON.stringify(reason));
      if (transacAbandonPendingRef.current) { console.log('[Paywall] onSkip suppressed for transac_abandon'); return; }
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        console.log('[Paywall] value skipped → registering', placement, 'in 600ms');
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({ placement, feature: () => { console.log('[Paywall] feature granted for', placement, '(via onSkip path) → navigateToMain'); navigateToMain(); } }).catch(() => navigateToMain());
        }, 600);
      } else {
        // Only exit if user is confirmed subscribed; otherwise re-show paywall
        if (subscriptionStatusRef.current === 'active') {
          console.log('[Paywall] paywall skipped — user subscribed → navigateToMain');
          navigateToMain();
        } else {
          console.log('[Paywall] paywall skipped by Superwall → re-showing in 600ms');
          mainPaywallRegisteredRef.current = false;
          setTimeout(() => {
            mainPaywallRegisteredRef.current = true;
            trackPlacementViewed(placement);
            registerPlacement({ placement, feature: () => { navigateToMain(); } }).catch(() => navigateToMain());
          }, 600);
        }
      }
    },
    onError: (err: unknown) => {
      console.error('[Paywall] Superwall onError:', err);
      navigateToMain();
    },
  });

  useEffect(() => {
    retriggerMainPaywallRef.current = () => {
      console.log('[Paywall] retriggerMainPaywallRef called → registering', placement);
      phaseRef.current = 'paywall';
      mainPaywallRegisteredRef.current = true;
      registerPlacement({ placement, feature: navigateToMain }).catch(() => navigateToMain());
    };
    return () => { retriggerMainPaywallRef.current = null; };
  }, [placement, navigateToMain, registerPlacement]);

  useEffect(() => {
    // Log Superwall subscription status on mount
    try {
      const sw = require('expo-superwall');
      sw.SuperwallExpoModule?.getSubscriptionStatus?.().then((s: any) => {
        console.log('[Paywall] Superwall subscriptionStatus on mount:', JSON.stringify(s));
      }).catch((e: any) => console.warn('[Paywall] getSubscriptionStatus error:', e));
    } catch {}
  }, []);

  useEffect(() => {
    trackPageViewed('paywall', { placement, shouldReturn });
    if (didPresentRef.current) return;
    getItem('dev:reviewer').then((isDev) => {
      if (isDev) { navigateToMain(); return; }
      didPresentRef.current = true;
      phaseRef.current = 'value';
      trackPlacementViewed(PLACEMENT_VALUE_SCREEN);
      registerPlacement({ placement: PLACEMENT_VALUE_SCREEN, feature: () => {
        console.log('[Paywall] feature granted for value_screen → registering', placement, 'in 600ms');
        phaseRef.current = 'paywall';
        if (mainPaywallRegisteredRef.current) { console.log('[Paywall] value_screen feature: main paywall already registered, skipping'); return; }
        mainPaywallRegisteredRef.current = true;
        setTimeout(() => {
          trackPlacementViewed(placement);
          console.log('[Paywall] registering', placement, 'now (via value_screen feature)');
          registerPlacement({ placement, feature: () => { console.log('[Paywall] feature granted for', placement, '(via value_screen feature path) → navigateToMain'); navigateToMain(); } }).catch(() => navigateToMain());
        }, 600);
      }}).catch(() => navigateToMain());
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
