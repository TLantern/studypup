import { getItem, setItem } from '@/lib/storage';

const KEY = 'dev:bypass_paywall';

let _cached = false;
let _hydrated = false;

export async function hydratePaywallBypass(): Promise<void> {
  try {
    const raw = await getItem(KEY);
    _cached = raw === '1';
  } catch {
    _cached = false;
  }
  _hydrated = true;
}

export function isPaywallBypassed(): boolean {
  return _hydrated && _cached;
}

export async function setPaywallBypassed(value: boolean): Promise<void> {
  _cached = value;
  _hydrated = true;
  await setItem(KEY, value ? '1' : '');
}

export async function togglePaywallBypassed(): Promise<boolean> {
  await setPaywallBypassed(!_cached);
  return _cached;
}
