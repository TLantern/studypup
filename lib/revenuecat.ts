import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import type Purchases from 'react-native-purchases';
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOfferings,
  LogInResult,
  CustomerInfoUpdateListener,
} from 'react-native-purchases';
import type RevenueCatUI from 'react-native-purchases-ui';

export const RC_ENTITLEMENT_ID = 'Notario - AI Note Taker Pro';

// Graceful loading — module is absent in Expo Go and on web
let _Purchases: typeof Purchases | null = null;
let _LOG_LEVEL: any = null;
let _RevenueCatUI: typeof RevenueCatUI | null = null;

try {
  const rc = require('react-native-purchases');
  _Purchases = rc.default as typeof Purchases;
  _LOG_LEVEL = rc.LOG_LEVEL;
  console.log('[RevenueCat] SDK loaded (v10)');
} catch (err) {
  console.warn('[RevenueCat] SDK not available (Expo Go / web):', err);
}

try {
  const rcui = require('react-native-purchases-ui');
  _RevenueCatUI = rcui.default as typeof RevenueCatUI;
  console.log('[RevenueCat] UI module loaded');
} catch (err) {
  console.warn('[RevenueCat] UI module not available:', err);
}

export const revenueCatAvailable = !!_Purchases;
export const revenueCatUIAvailable = !!_RevenueCatUI;

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Call once at app startup. Idempotent — safe to call multiple times.
 * Optionally pass a userId if already known (cached Firebase auth).
 */
export function configureRevenueCat(userId?: string | null): void {
  if (!_Purchases) return;

  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
    default: '',
  });

  if (!apiKey) {
    console.warn(
      '[RevenueCat] Missing API key — set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
    );
    return;
  }

  try {
    if (_LOG_LEVEL) _Purchases.setLogLevel(_LOG_LEVEL.NONE);
    // Not using the offerings/paywall system — silence RC's "no offerings configured"
    // notice, which it emits regardless of log level.
    _Purchases.setLogHandler((_level, message) => {
      if (message.includes('fetching offerings')) return;
    });
    _Purchases.configure({ apiKey, appUserID: userId ?? null });
    console.log(
      '[RevenueCat] Configured for',
      Platform.OS,
      userId ? `| user: ${userId}` : '| anonymous',
    );
  } catch (err) {
    console.error('[RevenueCat] configure() failed:', err);
  }
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/** Identify a signed-in user. Call when Firebase auth resolves to a user. */
export async function loginRevenueCat(userId: string): Promise<LogInResult | null> {
  if (!_Purchases) return null;
  try {
    const result = await _Purchases.logIn(userId);
    console.log('[RevenueCat] logIn:', userId, '| new RC user:', result.created);
    return result;
  } catch (err) {
    console.error('[RevenueCat] logIn failed:', err);
    return null;
  }
}

/** Revert to an anonymous RC identity. Call on Firebase sign-out. */
export async function logoutRevenueCat(): Promise<CustomerInfo | null> {
  if (!_Purchases) return null;
  try {
    return await _Purchases.logOut();
  } catch (err) {
    console.error('[RevenueCat] logOut failed:', err);
    return null;
  }
}

// ─── Customer info & entitlements ─────────────────────────────────────────────

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!_Purchases) return null;
  try {
    return await _Purchases.getCustomerInfo();
  } catch (err) {
    console.error('[RevenueCat] getCustomerInfo failed:', err);
    return null;
  }
}

/** One-shot entitlement check. Prefer the `useProEntitlement` hook for UI. */
export async function isProEntitled(): Promise<boolean> {
  const info = await getCustomerInfo();
  return !!info?.entitlements.active[RC_ENTITLEMENT_ID];
}

// ─── Offerings & purchases ────────────────────────────────────────────────────

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!_Purchases) return null;
  try {
    return await _Purchases.getOfferings();
  } catch (err) {
    console.error('[RevenueCat] getOfferings failed:', err);
    return null;
  }
}

/**
 * Purchase a package from the current offering.
 * Throws on failure so callers can distinguish user-cancel from hard errors:
 *   `err.userCancelled === true` means the user tapped Cancel.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  if (!_Purchases) return null;
  const result = await _Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

/** Restore prior purchases and return updated CustomerInfo. */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!_Purchases) return null;
  return _Purchases.restorePurchases();
}

// ─── Paywall presentation (imperative) ────────────────────────────────────────

/**
 * Present the default RevenueCat paywall as a full-screen modal.
 * Returns the PAYWALL_RESULT string, or null if the UI module isn't loaded.
 */
export async function presentPaywall(): Promise<string | null> {
  if (!_RevenueCatUI) {
    console.warn('[RevenueCat] UI not available — cannot present paywall');
    return null;
  }
  try {
    const result = await _RevenueCatUI.presentPaywall({ displayCloseButton: true });
    console.log('[RevenueCat] presentPaywall result:', result);
    return result as unknown as string;
  } catch (err) {
    console.error('[RevenueCat] presentPaywall failed:', err);
    return null;
  }
}

/**
 * Present the paywall ONLY if the user does NOT already have the Notario Pro
 * entitlement. Returns PAYWALL_RESULT.NOT_PRESENTED if they're already pro.
 */
export async function presentPaywallIfNeeded(): Promise<string | null> {
  if (!_RevenueCatUI) {
    console.warn('[RevenueCat] UI not available — cannot present paywall');
    return null;
  }
  try {
    const result = await _RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: RC_ENTITLEMENT_ID,
      displayCloseButton: true,
    });
    console.log('[RevenueCat] presentPaywallIfNeeded result:', result);
    return result as unknown as string;
  } catch (err) {
    console.error('[RevenueCat] presentPaywallIfNeeded failed:', err);
    return null;
  }
}

/** Open the RevenueCat Customer Center (self-service subscription management). */
export async function presentCustomerCenter(): Promise<void> {
  if (!_RevenueCatUI) {
    console.warn('[RevenueCat] UI not available — cannot present Customer Center');
    return;
  }
  try {
    await _RevenueCatUI.presentCustomerCenter();
  } catch (err) {
    console.error('[RevenueCat] presentCustomerCenter failed:', err);
  }
}

/** Raw access to the RevenueCatUI class for rendering <RevenueCatUI.Paywall> etc. */
export function getRevenueCatUI(): typeof RevenueCatUI | null {
  return _RevenueCatUI;
}

// ─── React hooks ──────────────────────────────────────────────────────────────

/**
 * Subscribes to live CustomerInfo updates. Re-renders whenever a purchase
 * or restore happens. Returns null until first fetch completes.
 */
export function useCustomerInfo(): CustomerInfo | null {
  const [info, setInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    if (!_Purchases) return;
    let mounted = true;

    _Purchases
      .getCustomerInfo()
      .then((i) => { if (mounted) setInfo(i); })
      .catch(() => {});

    const listener: CustomerInfoUpdateListener = (i) => {
      if (mounted) setInfo(i);
    };
    _Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      mounted = false;
      _Purchases?.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  return info;
}

/** Returns true when the current user holds the Notario Pro entitlement. */
export function useProEntitlement(): boolean {
  const info = useCustomerInfo();
  return !!info?.entitlements.active[RC_ENTITLEMENT_ID];
}
