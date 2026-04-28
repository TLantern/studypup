import { getAuth } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { getOnboarding, type OnboardingData, type UserTag } from '@/lib/onboarding-storage';

export type AppUser = {
  id: string;
  auth_provider: string;
  phone?: string;
  email?: string;
  display_name?: string;
  created_at: unknown;
  onboarding?: OnboardingData;
  onboarding_logged_at?: unknown;
  registered?: boolean;
  user_tag?: UserTag;
};

export async function writeUserTag(tag: UserTag): Promise<void> {
  const { db, auth } = getFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(doc(db, 'users', uid), { user_tag: tag }, { merge: true });
}

export async function checkUserRegistered(uid: string): Promise<boolean> {
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() && snap.data()?.registered === true;
}

export async function setUserRegistered(uid: string): Promise<void> {
  const { db } = getFirebase();
  await setDoc(doc(db, 'users', uid), { registered: true }, { merge: true });
}

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
    ...(user.displayName ? { display_name: user.displayName } : {}),
    created_at: serverTimestamp(),
  };
  if (Object.keys(onboarding).length > 0) {
    payload.onboarding = onboarding;
    payload.onboarding_logged_at = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
}

