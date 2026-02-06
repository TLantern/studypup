import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { getOnboarding, type OnboardingData } from '@/lib/onboarding-storage';

export type AppUser = {
  id: string;
  auth_provider: string;
  phone?: string;
  email?: string;
  created_at: unknown;
  onboarding?: OnboardingData;
  onboarding_logged_at?: unknown;
};

export async function ensureUserDoc(user: User): Promise<void> {
  const { db } = getFirebase();
  const provider = user.providerData?.[0]?.providerId ?? 'unknown';
  const onboarding = await getOnboarding();
  const ref = doc(db, 'users', user.uid);
  const payload: Record<string, unknown> = {
    id: user.uid,
    auth_provider: provider,
    ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
    ...(user.email ? { email: user.email } : {}),
    created_at: serverTimestamp(),
  };
  if (Object.keys(onboarding).length > 0) {
    payload.onboarding = onboarding;
    payload.onboarding_logged_at = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
}

