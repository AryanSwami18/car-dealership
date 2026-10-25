import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { clearStoredSession, readStoredSession, writeSession } from './storage';
import type { AuthSession, AuthUser } from './types';

type AuthContextValue = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: AuthUser | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());

  const signIn = useCallback((nextSession: AuthSession) => {
    writeSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: session !== null,
      isAdmin: session?.user?.role === 'ADMIN',
      user: session?.user ?? null,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
