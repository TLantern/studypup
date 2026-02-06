import { getItem, setItem } from '@/lib/storage';

export type OnboardingData = {
  country?: string;
  region?: string;
  grade_level?: string;
  subjects?: string[];
  plan_usage?: string[];
};

const ONBOARDING_KEY = 'onboarding';

export async function getOnboarding(): Promise<OnboardingData> {
  const raw = await getItem(ONBOARDING_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as OnboardingData;
  } catch {
    return {};
  }
}

export async function updateOnboarding(partial: Partial<OnboardingData>): Promise<void> {
  const current = await getOnboarding();
  const next = { ...current, ...partial };
  await setItem(ONBOARDING_KEY, JSON.stringify(next));
}
