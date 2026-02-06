import { createContext } from 'react';

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
