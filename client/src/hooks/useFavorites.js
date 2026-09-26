import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/** Personal favorite projects, saved on the user's profile. */
export function useFavorites() {
  const { user, updateProfile } = useAuth();
  const ids = useMemo(() => new Set((user?.favorites ?? []).map(String)), [user?.favorites]);

  const isFavorite = useCallback((projectId) => ids.has(String(projectId)), [ids]);

  const toggle = useCallback(
    (projectId) => {
      const next = new Set(ids);
      if (next.has(String(projectId))) next.delete(String(projectId));
      else next.add(String(projectId));
      updateProfile({ favorites: [...next] }); // optimistic, saved in the background
    },
    [ids, updateProfile]
  );

  /** Favorites first, keeping the original order inside each group. */
  const sortFavoritesFirst = useCallback((list) => [...list.filter((p) => ids.has(String(p._id))), ...list.filter((p) => !ids.has(String(p._id)))], [ids]);

  return { isFavorite, toggle, sortFavoritesFirst };
}
