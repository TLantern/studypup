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

const didInit = { current: false };

export async function initAnalytics() {
  if (didInit.current) return;
  didInit.current = true;
  if (!mixpanel) {
    console.log('[Mixpanel] Initialization skipped', { reason: mixpanelReadyReason });
    return;
  }
  try {
    console.log('[Mixpanel] Initialization started');
    await mixpanel.init();
    console.log('[Mixpanel] Initialization finished');
  } catch (error) {
    console.log('[Mixpanel] Initialization error', String(error));
  }
}

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

