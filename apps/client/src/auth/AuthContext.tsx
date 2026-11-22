/**
 * מצב ההתחברות של כל האפליקציה.
 *
 * בטעינה: אם יש טוקן שמור, שואלים את השרת מי המשתמש (/auth/me).
 * טוקן שפג או בוטל (401) מנתק את המשתמש אוטומטית.
 */

import type { AuthResponse, LoginRequest, RegisterRequest, UserDto } from "@cropguard/shared-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, setUnauthorizedHandler, tokenStore } from "../api/client";

interface AuthState {
  user: UserDto | null;
  /** true עד שבדיקת הטוקן השמור מסתיימת */
  loading: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const accept = useCallback((auth: AuthResponse) => {
    tokenStore.set(auth.token);
    setUser(auth.user);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // בדיקת הטוקן השמור פעם אחת בטעינה
  useEffect(() => {
    if (!tokenStore.get()) return;
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (input) => accept(await api.login(input)),
      register: async (input) => accept(await api.register(input)),
      logout,
    }),
    [user, loading, accept, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
