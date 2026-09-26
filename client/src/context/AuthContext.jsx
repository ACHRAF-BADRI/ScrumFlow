import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../i18n';
import { api, tokenStore } from '../lib/api';

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
    setUser(null);
  }, []);

  // Fired by the API client when the token is rejected
  useEffect(() => {
    const onUnauthorized = () => {
      if (!tokenStore.get()) return;
      logout();
      toast.error(i18n.t('errors.sessionExpired'));
    };
    window.addEventListener('sf:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sf:unauthorized', onUnauthorized);
  }, [logout]);

  const authenticate = useCallback(
    async (path, payload) => {
      const { data } = await api.post(path, payload);
      tokenStore.set(data.token);
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  /** Persist preferences (language, theme, name) on the profile – best effort. */
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

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (name, email, password) =>
        authenticate('/auth/register', { name, email, password, language: i18n.language?.slice(0, 2) }),
      logout,
      updateProfile,
    }),
    [user, loading, authenticate, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
