import { Platform, NativeModules } from 'react-native';

// ── PostHog ───────────────────────────────────────────────────────────────────

let posthog: any = null;

try {
  const { PostHog } = require('posthog-react-native');
  const phKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
  if (phKey) {
    posthog = new PostHog(phKey, { host: 'https://us.i.posthog.com' });
    console.log('[PostHog] instance created');
  } else {
    console.log('[PostHog] skipped — token missing');
  }
} catch (e) {
  console.log('[PostHog] failed to load:', String(e));
}

export function getPostHogClient() {
  return posthog;
}

// ── Mixpanel ──────────────────────────────────────────────────────────────────

let mixpanel: any = null;
let mixpanelInitCompleted = false;

// Events that arrive before init() completes are queued and flushed afterward.
type QueuedEvent = { eventName: string; payload: Record<string, any> };
const preInitQueue: QueuedEvent[] = [];

try {
  const { Mixpanel } = require('mixpanel-react-native');
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '';
  console.log('[Mixpanel] module loaded, token present:', !!token, 'length:', token.length);
  if (token) {
    mixpanel = new Mixpanel(token, false);
    console.log('[Mixpanel] instance created');
  } else {
    console.log('[Mixpanel] skipped — token missing');
  }
} catch (e) {
  console.log('[Mixpanel] failed to load:', String(e));
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
  console.log('[Analytics] initAnalytics — mixpanel ready:', !!mixpanel, 'posthog ready:', !!posthog);

  if (mixpanel) {
    try {
      await mixpanel.init();
      mixpanelInitCompleted = true;
      console.log('[Mixpanel] init() complete, queue depth:', preInitQueue.length);

      if (preInitQueue.length > 0) {
        for (const { eventName, payload } of preInitQueue) {
          console.log('[Mixpanel] flushing queued event:', eventName);
          mixpanel.track(eventName, payload);
        }
        preInitQueue.length = 0;
      }
    } catch (error) {
      console.log('[Mixpanel] init() error:', String(error));
    }
  }

  initAppsFlyer();
}

// ── Identity ──────────────────────────────────────────────────────────────────

export function identifyUser(uid: string) {
  if (mixpanel) {
    try {
      mixpanel.identify(uid);
    } catch (error) {
      console.log('[Mixpanel] identify() error:', String(error));
    }
  }
  if (posthog) {
    try {
      posthog.identify(uid);
    } catch (error) {
      console.log('[PostHog] identify() error:', String(error));
    }
  }
}

// ── Event helpers ─────────────────────────────────────────────────────────────

export function trackEvent(eventName: string, props?: Record<string, any>) {
  if (posthog) {
    try {
      posthog.capture(eventName, props ?? {});
    } catch (error) {
      console.log('[PostHog] capture() error:', String(error));
    }
  }
  if (mixpanel) {
    try {
      mixpanel.track(eventName, props ?? {});
    } catch (error) {
      console.log('[Mixpanel] track() error:', String(error));
    }
  }
}

export function trackPageViewed(page_name: string, props?: Record<string, any>) {
  if (!page_name?.trim()) return;

  const eventName = `${page_name.trim()}_viewed`;
  const payload = { page_name: page_name.trim(), ...(props ?? {}) };

  if (posthog) {
    try {
      posthog.capture(eventName, payload);
    } catch (error) {
      console.log('[PostHog] capture() error:', String(error));
    }
  }

  if (!mixpanel) {
    console.log('[Mixpanel] trackPageViewed skipped — not loaded', { page_name });
    return;
  }

  if (!mixpanelInitCompleted) {
    preInitQueue.push({ eventName, payload });
    console.log('[Mixpanel] queued:', eventName, '— queue depth:', preInitQueue.length);
    return;
  }

  try {
    mixpanel.track(eventName, payload);
  } catch (error) {
    console.log('[Mixpanel] track() error:', String(error));
  }
}
