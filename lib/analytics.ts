import { Platform, NativeModules } from 'react-native';

// ── Mixpanel ──────────────────────────────────────────────────────────────────

let mixpanel: any = null;
let mixpanelReadyReason = 'unknown';

try {
  const { Mixpanel } = require('mixpanel-react-native');
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';
  if (!token) {
    mixpanel = null;
    mixpanelReadyReason = 'missing_token';
  } else {
    mixpanel = new Mixpanel(token, false);
    mixpanelReadyReason = 'ready';
  }
} catch (error) {
  mixpanel = null;
  mixpanelReadyReason = `constructor_or_require_failed:${String(error)}`;
}

// ── AppsFlyer ─────────────────────────────────────────────────────────────────

const AF_DEV_KEY = process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY ?? '';
const AF_APP_ID = process.env.EXPO_PUBLIC_APPSFLYER_APP_ID ?? ''; // iOS App Store ID (digits only)

let appsFlyer: any = null;
let appsFlyerReady = false;

function initAppsFlyer() {
  if (!AF_DEV_KEY) {
    console.log('[AppsFlyer] Skipped — missing EXPO_PUBLIC_APPSFLYER_DEV_KEY');
    return;
  }
  if (!NativeModules.RNAppsFlyer) {
    console.log('[AppsFlyer] Native module not found — rebuild the app after pod install');
    return;
  }
  try {
    const mod = require('react-native-appsflyer');
    appsFlyer = mod.default ?? mod;
    appsFlyerReady = true; // native module exists — safe to call logEvent immediately
  } catch (e) {
    console.log('[AppsFlyer] Failed to load SDK', String(e));
    return;
  }

  appsFlyer.initSdk(
    {
      devKey: AF_DEV_KEY,
      isDebug: __DEV__,
      appId: Platform.OS === 'ios' ? AF_APP_ID.replace(/^id/i, '') : undefined,
      onInstallConversionDataListener: true,
      onDeepLinkListener: true,
      timeToWaitForATTUserAuthorization: 10,
    },
    () => {
      appsFlyerReady = true;
      console.log('[AppsFlyer] SDK initialized');
    },
    (err) => {
      console.log('[AppsFlyer] Init error', err);
    },
  );

  // UID must come from conversions.appsflyersdk, not launches.appsflyersdk
  appsFlyer.onInstallConversionData((data: any) => {
    appsFlyerReady = true; // SDK is confirmed working even if initSdk callback didn't fire
    console.log('[AppsFlyer] conversions.appsflyersdk', JSON.stringify(data));
    // data.data.uid is only present on non-organic installs; fall back to getAppsFlyerUID()
    const uidFromConversion = data?.data?.uid ?? null;
    if (uidFromConversion) {
      appsFlyer.setCustomerUserId(uidFromConversion, () => {
        console.log('[AppsFlyer] customerUserID set from conversion', uidFromConversion);
      });
    } else {
      appsFlyer.getAppsFlyerUID((err: any, uid: string) => {
        if (!err && uid) {
          appsFlyer.setCustomerUserId(uid, () => {
            console.log('[AppsFlyer] customerUserID set from getAppsFlyerUID', uid);
          });
        }
      });
    }
  });
}

export function logAppsFlyerEvent(eventName: string, eventValues?: Record<string, any>) {
  if (!appsFlyer) {
    console.log('[AppsFlyer] logEvent skipped — SDK not loaded', { eventName, appsFlyerReady });
    return;
  }
  console.log('[AppsFlyer] logEvent →', eventName, eventValues);
  appsFlyer.logEvent(
    eventName,
    eventValues ?? {},
    (res: any) => console.log('[AppsFlyer] logEvent ok', eventName, res),
    (err: any) => console.log('[AppsFlyer] logEvent error', eventName, err),
  );
}

// ── Shared init ───────────────────────────────────────────────────────────────

const didInit = { current: false };

export async function initAnalytics() {
  if (didInit.current) return;
  didInit.current = true;

  // Mixpanel
  if (!mixpanel) {
    console.log('[Mixpanel] Initialization skipped', { reason: mixpanelReadyReason });
  } else {
    try {
      console.log('[Mixpanel] Initialization started');
      await mixpanel.init();
      console.log('[Mixpanel] Initialization finished');
    } catch (error) {
      console.log('[Mixpanel] Initialization error', String(error));
    }
  }

  // AppsFlyer
  initAppsFlyer();
}

// ── Event helpers ─────────────────────────────────────────────────────────────

export function trackPageViewed(page_name: string, props?: Record<string, any>) {
  const pageName = (page_name ?? '').trim();
  if (!mixpanel || !pageName) {
    console.log('[Mixpanel] page_viewed skipped', {
      hasMixpanel: !!mixpanel,
      hasPageName: !!pageName,
      page_name: pageName,
    });
    return;
  }
  try {
    const eventName = `${pageName}_viewed`;
    const payload = { page_name: pageName, ...(props ?? {}) };
    console.log('[Mixpanel] Tracking custom viewed event', { eventName, payload });
    mixpanel.track(eventName, payload);
    console.log('[Mixpanel] custom viewed track call completed', { eventName });
  } catch (error) {
    console.log('[Mixpanel] custom viewed track error', { page_name: pageName, error: String(error) });
  }
}
