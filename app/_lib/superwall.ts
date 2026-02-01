import { createContext } from 'react';

let SuperwallProvider: React.ComponentType<any> | null = null;
let usePlacementHook: typeof import('expo-superwall').usePlacement | null = null;

try {
  const sw = require('expo-superwall');
  SuperwallProvider = sw.SuperwallProvider;
  usePlacementHook = sw.usePlacement;
} catch {
  // Native module not available (Expo Go)
}

export const SuperwallAvailableContext = createContext(!!SuperwallProvider);
export { SuperwallProvider, usePlacementHook };
