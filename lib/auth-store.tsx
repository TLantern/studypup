import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/user-profile';

type AuthState = {
  loading: boolean;
  user: User | null;
  uid: string | null;
  authProvider: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { auth } = getFirebase();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) ensureUserDoc(u).catch((e) => console.error('Failed to ensure user doc:', e));
    });
    return unsub;
  }, [auth]);

  const value = useMemo<AuthState>(() => {
    const authProvider = user?.providerData?.[0]?.providerId ?? null;
    return {
      loading,
      user,
      uid: user?.uid ?? null,
      authProvider,
      signOut: () => signOut(auth),
    };
  }, [auth, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

