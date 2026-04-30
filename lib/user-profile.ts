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

export type ProfessionalUser = {
  id: string;
  auth_provider: string;
  phone?: string;
  email?: string;
  display_name?: string;
  created_at: unknown;
  registered?: boolean;
  onboarding?: {
    user_tag: 'working-class';
    work_type?: string;
    meetings_per_week?: string;
    meeting_notes_method?: string[];
    focus_struggle?: string;
  };
  onboarding_logged_at?: unknown;
};

export async function writeUserTag(tag: UserTag): Promise<void> {
  const { db, auth } = getFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const collection = tag === 'working-class' ? 'professionals' : 'users';
  await setDoc(doc(db, collection, uid), { user_tag: tag }, { merge: true });
}

export async function checkUserRegistered(uid: string): Promise<boolean> {
  const { db } = getFirebase();
  const [userSnap, proSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'professionals', uid)),
  ]);
  return (
    (userSnap.exists() && userSnap.data()?.registered === true) ||
    (proSnap.exists() && proSnap.data()?.registered === true)
  );
}

export async function setUserRegistered(uid: string): Promise<void> {
  const { db } = getFirebase();
  const onboarding = await getOnboarding();
  const collection = onboarding.user_tag === 'working-class' ? 'professionals' : 'users';
  await setDoc(doc(db, collection, uid), { registered: true }, { merge: true });
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

export async function ensureProfessionalDoc(user: User): Promise<void> {
  const { db } = getFirebase();
  const provider = user.providerData?.[0]?.providerId ?? 'unknown';
  const onboarding = await getOnboarding();
  const ref = doc(db, 'professionals', user.uid);
  const payload: Record<string, unknown> = {
    id: user.uid,
    auth_provider: provider,
    ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
    ...(user.email ? { email: user.email } : {}),
    ...(user.displayName ? { display_name: user.displayName } : {}),
    created_at: serverTimestamp(),
  };
  const proOnboarding: ProfessionalUser['onboarding'] = {
    user_tag: 'working-class',
    ...(onboarding.work_type ? { work_type: onboarding.work_type } : {}),
    ...(onboarding.meetings_per_week ? { meetings_per_week: onboarding.meetings_per_week } : {}),
    ...(onboarding.meeting_notes_method ? { meeting_notes_method: onboarding.meeting_notes_method } : {}),
    ...(onboarding.focus_struggle ? { focus_struggle: onboarding.focus_struggle } : {}),
  };
  payload.onboarding = proOnboarding;
  payload.onboarding_logged_at = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
}

