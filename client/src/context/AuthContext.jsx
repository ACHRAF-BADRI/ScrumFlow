import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../i18n';
import { api, tokenStore } from '../lib/api';
import { clearOfflineData } from '../lib/pwa';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const applyUser = useCallback((nextUser) => {
    setUser(nextUser);
    // The profile language wins over the browser language once logged in
    if (nextUser?.language && !i18n.language?.startsWith(nextUser.language)) {
      i18n.changeLanguage(nextUser.language);
    }
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then(({ data }) => applyUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [applyUser]);

  const logout = useCallback(() => {
    tokenStore.clear();
    clearOfflineData();
    setUser(null);
  }, []);

  // Fired by the API client when the token is rejected
  useEffect(() => {
    const onUnauthorized = (event) => {
      if (!tokenStore.get()) return;
      logout();
      const code = event.detail?.code;
      toast.error(i18n.t(code === 'errors.accountSuspended' ? code : 'errors.sessionExpired'), { id: 'session' });
    };
    window.addEventListener('sf:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sf:unauthorized', onUnauthorized);
  }, [logout]);

  const authenticate = useCallback(
    async (path, payload) => {
      const { data } = await api.post(path, payload);
      // Two-step verification: the caller asks for the code, then calls verifyTwoFactor
      if (data.twoFactor) return { twoFactor: true, ticket: data.ticket };
      tokenStore.set(data.token);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const verifyTwoFactor = useCallback(
    async (ticket, code) => {
      const { data } = await api.post('/auth/2fa', { ticket, code });
      tokenStore.set(data.token);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  /** Session token from "Sign in with Google / GitHub". */
  const signInWithToken = useCallback(
    async (token) => {
      tokenStore.set(token);
      try {
        const { data } = await api.get('/auth/me');
        applyUser(data.user);
        return data.user;
      } catch (err) {
        tokenStore.clear();
        throw err;
      }
    },
    [applyUser]
  );

  /** Persist preferences (language, theme, name) on the profile, best effort. */
  const updateProfile = useCallback(
    async (changes) => {
      if (!tokenStore.get()) return;
      setUser((u) => (u ? { ...u, ...changes } : u));
      try {
        const { data } = await api.patch('/auth/me', changes);
        setUser(data.user);
      } catch {
        /* preferences are also stored locally, ignore */
      }
    },
    []
  );

  /** Sign in with a token returned by the API (e.g. after a password reset). */
  const signInWith = useCallback(
    (data) => {
      tokenStore.set(data.token);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  /** Save account details; unlike updateProfile, errors are thrown to the caller. */
  const saveProfile = useCallback(async (changes) => {
    const { data } = await api.patch('/auth/me', changes);
    setUser(data.user);
    return data.user;
  }, []);

  const changePassword = useCallback((currentPassword, newPassword) => api.post('/auth/me/password', { currentPassword, newPassword }), []);

  /** `confirm` must be the user's exact name (checked by the API too). */
  const deleteAccount = useCallback(async (confirm) => {
    const { data } = await api.delete('/auth/me', { data: { confirm } });
    tokenStore.clear();
    setUser(null);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (name, email, password) =>
        authenticate('/auth/register', { name, email, password, language: i18n.language?.slice(0, 2) }),
      logout,
      updateProfile,
      saveProfile,
      changePassword,
      deleteAccount,
      signInWith,
      verifyTwoFactor,
      signInWithToken,
      setUser,
    }),
    [user, loading, authenticate, logout, updateProfile, saveProfile, changePassword, deleteAccount, signInWith, verifyTwoFactor, signInWithToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
