import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SuperwallAvailableContext,
  usePlacementHook,
  PLACEMENT_VALUE_SCREEN,
  transacAbandonPendingRef,
  retriggerMainPaywallRef,
  useSubscriptionStatus,
} from '@/lib/superwall';
import { trackPageViewed } from '@/lib/analytics';
import { isPaywallBypassed } from '@/lib/dev-bypass';

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
    console.log('[Paywall] navigateToMain →', shouldReturn ? 'back' : '/create-account');
    if (shouldReturn) router.back();
    else router.replace('/create-account');
  }, [shouldReturn]);

  const didPresentRef = useRef(false);
  const phaseRef = useRef<'value' | 'paywall'>('value');
  const mainPaywallRegisteredRef = useRef(false);

  const trackPlacementViewed = useCallback((placementName: string) => {
    trackPageViewed(
      placementName === PLACEMENT_VALUE_SCREEN ? 'value_screen' : 'onboarding_complete_placement',
      { placement: placementName, shouldReturn },
    );
  }, [shouldReturn]);

  const retryPaywallRef = useRef<() => void>(() => {
    console.warn('[Paywall] retryPaywall called before initialized');
  });

  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Paywall] onPresent:', info?.name, '| phase:', phaseRef.current);
    },
    onDismiss: () => {
      console.log('[Paywall] onDismiss — phase:', phaseRef.current, '| transacPending:', transacAbandonPendingRef.current);
      if (transacAbandonPendingRef.current) {
        console.log('[Paywall] onDismiss suppressed — TransactionAbandonWatcher handling');
        return;
      }
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        if (mainPaywallRegisteredRef.current) return;
        mainPaywallRegisteredRef.current = true;
        console.log('[Paywall] value dismissed → registering', placement, 'in 600ms');
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({
            placement,
            feature: () => { console.log('[Paywall] purchased →', placement); navigateToMain(); },
          }).catch(() => retryPaywallRef.current());
        }, 600);
      } else {
        console.log('[Paywall] paywall dismissed without purchase → retrying');
        retryPaywallRef.current();
      }
    },
    onSkip: (reason) => {
      console.log('[Paywall] onSkip — phase:', phaseRef.current, '| transacPending:', transacAbandonPendingRef.current, '| reason:', JSON.stringify(reason));
      if (transacAbandonPendingRef.current) return;
      if (phaseRef.current === 'value') {
        phaseRef.current = 'paywall';
        console.log('[Paywall] value skipped → registering', placement, 'in 600ms');
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({
            placement,
            feature: () => { console.log('[Paywall] purchased (skip path) →', placement); navigateToMain(); },
          }).catch(() => retryPaywallRef.current());
        }, 600);
      } else {
        if (subscriptionStatusRef.current === 'active') {
          console.log('[Paywall] paywall skipped — user subscribed → navigateToMain');
          navigateToMain();
        } else {
          console.log('[Paywall] paywall skipped (not subscribed) → retrying');
          retryPaywallRef.current();
        }
      }
    },
    onError: (err: unknown) => {
      console.error('[Paywall] onError — retrying:', err);
      retryPaywallRef.current();
    },
  });

  useEffect(() => {
    retryPaywallRef.current = () => {
      console.log('[Paywall] retryPaywall → re-showing', placement);
      phaseRef.current = 'paywall';
      mainPaywallRegisteredRef.current = false;
      setTimeout(() => {
        mainPaywallRegisteredRef.current = true;
        trackPlacementViewed(placement);
        registerPlacement({
          placement,
          feature: () => { console.log('[Paywall] purchased (retry) →', placement); navigateToMain(); },
        }).catch(() => {
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
    trackPageViewed('paywall', { placement, shouldReturn });
    if (didPresentRef.current) return;

    if (isPaywallBypassed()) {
      console.log('[Paywall] dev bypass active → navigateToMain');
      navigateToMain();
      return;
    }

    didPresentRef.current = true;
    phaseRef.current = 'value';
    trackPlacementViewed(PLACEMENT_VALUE_SCREEN);
    console.log('[Paywall] registering value_screen');
    registerPlacement({
      placement: PLACEMENT_VALUE_SCREEN,
      feature: () => {
        console.log('[Paywall] value_screen feature → registering', placement, 'in 600ms');
        phaseRef.current = 'paywall';
        if (mainPaywallRegisteredRef.current) return;
        mainPaywallRegisteredRef.current = true;
        setTimeout(() => {
          trackPlacementViewed(placement);
          registerPlacement({
            placement,
            feature: () => { console.log('[Paywall] purchased (value_screen path) →', placement); navigateToMain(); },
          }).catch(() => retryPaywallRef.current());
        }, 600);
      },
    }).catch(() => {
      console.warn('[Paywall] value_screen failed → jumping directly to', placement);
      phaseRef.current = 'paywall';
      setTimeout(() => retryPaywallRef.current(), 600);
    });
  }, [placement, navigateToMain, registerPlacement, shouldReturn, trackPlacementViewed]);

  return <View style={styles.bg} />;
}

function PaywallWithoutSuperwall() {
  const params = useLocalSearchParams<{ return?: string }>();
  const shouldReturn = params.return === '1';

  useEffect(() => {
    console.log('[Paywall] Superwall unavailable → navigating away');
    trackPageViewed('paywall', { bypassed: true });
    if (shouldReturn) router.back();
    else router.replace('/create-account');
  }, []);

  return <View style={styles.bg} />;
}

export default function PaywallScreen() {
  const superwallAvailable = useContext(SuperwallAvailableContext);
  return superwallAvailable ? <PaywallWithSuperwall /> : <PaywallWithoutSuperwall />;
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
});
