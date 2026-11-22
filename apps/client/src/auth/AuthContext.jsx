/**
 * מצב ההתחברות של כל האפליקציה.
 *
 * בטעינה: אם יש טוקן שמור, שואלים את השרת מי המשתמש (/auth/me).
 * טוקן שפג או בוטל (401) מנתק את המשתמש אוטומטית.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, setUnauthorizedHandler, tokenStore } from "../api/client";

/**
 * @typedef {object} AuthState
 * @property {UserDto | null} user
 * @property {boolean} loading - true עד שבדיקת הטוקן השמור מסתיימת
 * @property {(input: LoginRequest) => Promise<void>} login
 * @property {(input: RegisterRequest) => Promise<void>} register
 * @property {() => void} logout
 * @property {(user: UserDto) => void} setCurrentUser - עדכון פרטי המשתמש אחרי שינוי בשרת (למשל טלפון)
 */

const AuthContext = createContext(null);

/** מחזיק את המשתמש המחובר לכל האפליקציה; בטעינה בודק מול השרת אם הטוקן השמור עדיין תקף */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const accept = useCallback((auth) => {
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

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (input) => accept(await api.login(input)),
      register: async (input) => accept(await api.register(input)),
      logout,
      setCurrentUser: setUser,
    }),
    [user, loading, accept, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** גישה למצב ההתחברות מכל רכיב; מחוץ ל-AuthProvider - שגיאה ברורה */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
