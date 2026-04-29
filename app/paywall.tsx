import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MeshGradientBackground } from '@/components/MeshGradientBackground';
import { trackPageViewed } from '@/lib/analytics';

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ placement?: string; return?: string }>();
  const shouldReturn = params.return === '1';
  const didRedirectRef = useRef(false);

  useEffect(() => {
    trackPageViewed('paywall', { placement: params.placement, shouldReturn, bypassed: true });
    if (didRedirectRef.current) return;
    didRedirectRef.current = true;
    if (shouldReturn) router.back();
    else router.replace('/create-account');
  }, [params.placement, shouldReturn]);

  return <View style={StyleSheet.absoluteFill}><MeshGradientBackground /></View>;
}
