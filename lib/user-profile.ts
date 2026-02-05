import type { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';

export type AppUser = {
  id: string;
  auth_provider: string;
  phone?: string;
  email?: string;
  created_at: unknown;
};

export async function ensureUserDoc(user: User): Promise<void> {
  const { db } = getFirebase();
  const provider = user.providerData?.[0]?.providerId ?? 'unknown';
  const ref = doc(db, 'users', user.uid);
  await setDoc(
    ref,
    {
      id: user.uid,
      auth_provider: provider,
      ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
      ...(user.email ? { email: user.email } : {}),
      created_at: serverTimestamp(),
    },
    { merge: true }
  );
}

