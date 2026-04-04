import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { deleteUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/user-profile';
import { getItem, setItem } from '@/lib/storage';

const STORED_USER_KEY = 'auth:user';
const STORED_PHONE_KEY = 'auth:phone';

type AuthState = {
  loading: boolean;
  user: User | null;
  uid: string | null;
  authProvider: string | null;
  signOut: () => Promise<void>;
  deleteUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { auth } = getFirebase();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    
    // Function to save user data
    const saveUserData = async (user: User | null) => {
      try {
        if (user) {
          const userData = {
            uid: user.uid,
            phoneNumber: user.phoneNumber,
            email: user.email,
            displayName: user.displayName,
            providerId: user.providerData?.[0]?.providerId,
          };
          await setItem(STORED_USER_KEY, JSON.stringify(userData));
          if (user.phoneNumber) {
            await setItem(STORED_PHONE_KEY, user.phoneNumber);
          }
        } else {
          await setItem(STORED_USER_KEY, '');
          await setItem(STORED_PHONE_KEY, '');
        }
      } catch (error) {
        console.error('Failed to save user data:', error);
      }
    };

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!mounted) return;
      setUser(u);
      setLoading(false);
      saveUserData(u);
      if (u) ensureUserDoc(u).catch((e) => console.error('Failed to ensure user doc:', e));
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [auth]);

  const value = useMemo<AuthState>(() => {
    const authProvider = user?.providerData?.[0]?.providerId ?? null;
    return {
      loading,
      user,
      uid: user?.uid ?? null,
      authProvider,
      signOut: async () => {
        try {
          await signOut(auth);
          await setItem(STORED_USER_KEY, '');
          await setItem(STORED_PHONE_KEY, '');
          try {
            const { default: SuperwallExpoModule } = await import('expo-superwall').then(m => ({ default: m.SuperwallExpoModule }));
            await SuperwallExpoModule.reset();
          } catch (_) {}
        } catch (error) {
          console.error('Failed to sign out:', error);
          throw error;
        }
      },
      deleteUser: async () => {
        if (!user) throw new Error('No user');
        await deleteUser(user);
        await setItem(STORED_USER_KEY, '');
        await setItem(STORED_PHONE_KEY, '');
      },
    };
  }, [auth, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Utility function to get stored phone number
export async function getStoredPhoneNumber(): Promise<string | null> {
  try {
    return await getItem(STORED_PHONE_KEY);
  } catch (error) {
    console.error('Failed to get stored phone number:', error);
    return null;
  }
}

// Utility function to get stored user data
export async function getStoredUserData(): Promise<any | null> {
  try {
    const userData = await getItem(STORED_USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Failed to get stored user data:', error);
    return null;
  }
}

// Utility function to clear stored auth data (useful for debugging)
export async function clearStoredAuthData(): Promise<void> {
  try {
    await setItem(STORED_USER_KEY, '');
    await setItem(STORED_PHONE_KEY, '');
    console.log('Cleared stored auth data');
  } catch (error) {
    console.error('Failed to clear stored auth data:', error);
  }
}

