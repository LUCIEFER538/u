import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, tokenStore } from '../lib/api';
import type { User } from '../types';

interface Credentials {
  email: string;
  password: string;
}

interface RegistrationDetails extends Credentials {
  username: string;
  display_name?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signUp: (details: RegistrationDetails) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setIsRestoring(false);
      return;
    }

    api
      .me()
      .then(setUser)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) tokenStore.clear();
      })
      .finally(() => setIsRestoring(false));
  }, []);

  const signIn = useCallback(async (credentials: Credentials) => {
    const result = await api.login(credentials);
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const signUp = useCallback(async (details: RegistrationDetails) => {
    const result = await api.register(details);
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isRestoring,
      signIn,
      signUp,
      signOut,
      setUser,
    }),
    [user, isRestoring, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
