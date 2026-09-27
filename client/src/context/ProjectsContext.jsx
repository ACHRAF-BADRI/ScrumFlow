import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, toastError } from '../lib/api';
import { useRealtimeEvent } from './RealtimeContext';

const ProjectsContext = createContext(null);

/** The list of projects the user belongs to (sidebar + projects page). */
export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Added to / removed from a project, or a project was deleted
  useRealtimeEvent('projects:changed', () => refresh());

  const createProject = useCallback(async (payload) => {
    const { data } = await api.post('/projects', payload);
    const project = { ...data.project, stats: { total: 0, done: 0 }, activeSprint: null };
    setProjects((list) => [project, ...list]);
    return project;
  }, []);

  /** Merge fresh fields (after rename, member change…) without losing stats. */
  const patchLocal = useCallback((project) => {
    setProjects((list) => list.map((p) => (p._id === project._id ? { ...p, ...project } : p)));
  }, []);

  const removeLocal = useCallback((id) => setProjects((list) => list.filter((p) => p._id !== id)), []);

  const value = useMemo(
    () => ({ projects, loading, error, refresh, createProject, patchLocal, removeLocal }),
    [projects, loading, error, refresh, createProject, patchLocal, removeLocal]
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export const useProjects = () => useContext(ProjectsContext);
