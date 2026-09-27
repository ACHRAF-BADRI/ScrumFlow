import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, toastError } from '../lib/api';
import { MANAGER_ROLES } from '../lib/constants';
import { useProjects } from './ProjectsContext';
import { useRealtime, useRealtimeEvent } from './RealtimeContext';

const ProjectContext = createContext(null);
const REFRESH_MS = 30_000;

/**
 * Loads one project with its sprints and tasks and exposes optimistic
 * mutations. Teammates' changes arrive live through the socket (the page
 * reloads its data silently); polling every 30s is only a fallback while the
 * socket is disconnected.
 */
export function ProjectProvider({ projectId, children }) {
  const { patchLocal, removeLocal } = useProjects();
  const { socket, connected } = useRealtime();
  const [viewers, setViewers] = useState([]);
  const reloadTimer = useRef(null);
  const [project, setProject] = useState(null);
  const [role, setRole] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Pause background refreshes while the user is mid-interaction (drag, pending save)
  const busy = useRef(0);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const base = `/projects/${projectId}`;

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const [p, s, tk] = await Promise.all([api.get(base), api.get(`${base}/sprints`), api.get(`${base}/tasks`)]);
        if (silent && busy.current > 0) return;
        setProject(p.data.project);
        setRole(p.data.role);
        setSprints(s.data.sprints);
        setTasks(tk.data.tasks);
        setError(null);
      } catch (err) {
        // A silent refresh that gets 404 means the project is gone or we were removed from it
        if (!silent || err.response?.status === 404) {
          setError(err);
          if (silent) setProject(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [base]
  );

  useEffect(() => {
    setProject(null);
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && busy.current === 0 && load({ silent: true });
    // Live updates come from the socket; poll only while it is disconnected
    const timer = connected ? null : setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [load, connected]);

  /** Debounced silent reload that waits for the user to finish a drag or a save. */
  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    const run = () => {
      if (busy.current > 0) {
        reloadTimer.current = setTimeout(run, 800);
        return;
      }
      load({ silent: true });
    };
    reloadTimer.current = setTimeout(run, 250);
  }, [load]);
  useEffect(() => () => clearTimeout(reloadTimer.current), []);

  // Join the project's room (again after a reconnect, catching up on missed changes)
  useEffect(() => {
    if (!socket) return undefined;
    let joinedOnce = false;
    const join = () => {
      socket.emit('project:join', projectId);
      if (joinedOnce) scheduleReload();
      joinedOnce = true;
    };
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('project:leave');
      setViewers([]);
    };
  }, [socket, projectId, scheduleReload]);

  useRealtimeEvent('project:changed', (event) => {
    if (event.projectId !== projectId) return;
    if (event.kind === 'deleted') {
      removeLocal(projectId);
      setProject(null);
      setError({ response: { status: 404, data: { code: 'errors.projectNotFound' } } });
      return;
    }
    scheduleReload();
  });

  useRealtimeEvent('presence', (event) => {
    if (event.projectId === projectId) setViewers(event.users);
  });

  const members = useMemo(
    () => (project?.members ?? []).filter((m) => m.user).map((m) => ({ ...m.user, role: m.role })),
    [project]
  );
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m._id, m])), [members]);

  /** Runs `request` while background refresh is paused. */
  const guarded = useCallback(async (request) => {
    busy.current += 1;
    try {
      return await request();
    } finally {
      busy.current -= 1;
    }
  }, []);

  const replaceTask = useCallback((task) => setTasks((list) => list.map((t) => (t._id === task._id ? task : t))), []);

  // Apply changes locally, resolving ids to the populated objects the UI renders
  const applyLocal = useCallback(
    (task, changes) => {
      const next = { ...task, ...changes };
      if ('assignee' in changes) next.assignee = changes.assignee ? memberById[changes.assignee] ?? null : null;
      if ('sprint' in changes) next.sprint = changes.sprint || null;
      if (changes.status) next.completedAt = changes.status === 'done' ? task.completedAt ?? new Date().toISOString() : null;
      return next;
    },
    [memberById]
  );

  const actions = useMemo(
    () => ({
      reload: () => load({ silent: true }),
      pause: () => {
        busy.current += 1;
      },
      resume: () => {
        busy.current = Math.max(0, busy.current - 1);
      },

      // ---- Tasks ----
      async createTask(payload) {
        const { data } = await guarded(() => api.post(`${base}/tasks`, payload));
        setTasks((list) => [...list, data.task]);
        return data.task;
      },

      async updateTask(taskId, changes) {
        const previous = tasksRef.current.find((t) => t._id === taskId);
        if (!previous) return null;
        replaceTask(applyLocal(previous, changes));
        try {
          const { data } = await guarded(() => api.patch(`${base}/tasks/${taskId}`, changes));
          replaceTask(data.task);
          return data.task;
        } catch (err) {
          replaceTask(previous);
          toastError(err);
          return null;
        }
      },

      async deleteTask(taskId) {
        const snapshot = tasksRef.current;
        setTasks((list) => list.filter((t) => t._id !== taskId));
        try {
          await guarded(() => api.delete(`${base}/tasks/${taskId}`));
          return true;
        } catch (err) {
          setTasks(snapshot);
          toastError(err);
          return false;
        }
      },

      /**
       * Persist a drag & drop: `changes` is the new container field
       * ({ status } or { sprint }) and `orderedIds` the destination order.
       */
      async moveTask(taskId, changes, orderedIds) {
        const orderOf = Object.fromEntries(orderedIds.map((id, index) => [id, index + 1]));
        setTasks((list) =>
          list.map((t) => {
            let next = t._id === taskId && changes ? applyLocal(t, changes) : t;
            if (orderOf[t._id] !== undefined) next = { ...next, order: orderOf[t._id] };
            return next;
          })
        );
        try {
          await guarded(async () => {
            if (changes && 'sprint' in changes) await api.patch(`${base}/tasks/${taskId}`, { sprint: changes.sprint ?? null });
            const items = orderedIds.map((id) => ({
              id,
              order: orderOf[id],
              ...(id === taskId && changes?.status ? { status: changes.status } : {}),
            }));
            await api.post(`${base}/tasks/reorder`, { items });
          });
        } catch (err) {
          toastError(err);
          load({ silent: true });
        }
      },

      async addComment(taskId, text) {
        const { data } = await guarded(() => api.post(`${base}/tasks/${taskId}/comments`, { text }));
        replaceTask(data.task);
        return data.task;
      },

      async deleteComment(taskId, commentId) {
        const { data } = await guarded(() => api.delete(`${base}/tasks/${taskId}/comments/${commentId}`));
        replaceTask(data.task);
      },

      // ---- Sprints ----
      async createSprint(payload) {
        const { data } = await guarded(() => api.post(`${base}/sprints`, payload));
        setSprints((list) => [...list, data.sprint]);
        return data.sprint;
      },

      async updateSprint(sprintId, changes) {
        const { data } = await guarded(() => api.patch(`${base}/sprints/${sprintId}`, changes));
        setSprints((list) => list.map((s) => (s._id === sprintId ? data.sprint : s)));
        return data.sprint;
      },

      async deleteSprint(sprintId) {
        await guarded(() => api.delete(`${base}/sprints/${sprintId}`));
        setSprints((list) => list.filter((s) => s._id !== sprintId));
        setTasks((list) => list.map((t) => (t.sprint === sprintId ? { ...t, sprint: null } : t)));
      },

      async startSprint(sprintId, payload) {
        const { data } = await guarded(() => api.post(`${base}/sprints/${sprintId}/start`, payload));
        setSprints((list) => list.map((s) => (s._id === sprintId ? data.sprint : s)));
        return data.sprint;
      },

      async completeSprint(sprintId, moveTo) {
        const { data } = await guarded(() => api.post(`${base}/sprints/${sprintId}/complete`, { moveTo }));
        setSprints((list) => list.map((s) => (s._id === sprintId ? data.sprint : s)));
        const target = moveTo && moveTo !== 'backlog' ? moveTo : null;
        setTasks((list) => list.map((t) => (t.sprint === sprintId && t.status !== 'done' ? { ...t, sprint: target } : t)));
        return data;
      },

      // ---- Project & team ----
      async updateProject(changes) {
        const { data } = await guarded(() => api.patch(base, changes));
        setProject(data.project);
        patchLocal(data.project);
      },

      async deleteProject() {
        await api.delete(base);
        removeLocal(projectId);
      },

      async addMember(email, memberRole) {
        const { data } = await guarded(() => api.post(`${base}/members`, { email, role: memberRole }));
        if (data.project) {
          setProject(data.project);
          patchLocal(data.project);
        }
        return data; // { project } or { invited, email, emailSent, inviteUrl }
      },

      listInvitations: () => api.get(`${base}/invitations`).then(({ data }) => data.invitations),
      revokeInvitation: (invitationId) => api.delete(`${base}/invitations/${invitationId}`),

      async updateMemberRole(userId, memberRole) {
        const { data } = await guarded(() => api.patch(`${base}/members/${userId}`, { role: memberRole }));
        setProject(data.project);
      },

      async removeMember(userId, { self = false } = {}) {
        const { data } = await guarded(() => api.delete(`${base}/members/${userId}`));
        if (self) {
          removeLocal(projectId);
          return;
        }
        setProject(data.project);
        patchLocal(data.project);
        setTasks((list) => list.map((t) => (t.assignee?._id === userId ? { ...t, assignee: null } : t)));
      },
    }),
    [base, load, guarded, replaceTask, applyLocal, patchLocal, removeLocal, projectId]
  );

  const value = useMemo(
    () => ({
      project,
      role,
      canManage: MANAGER_ROLES.includes(role),
      sprints,
      tasks,
      members,
      memberById,
      activeSprint: sprints.find((s) => s.status === 'active') ?? null,
      loading,
      error,
      viewers,
      live: connected,
      ...actions,
    }),
    [project, role, sprints, tasks, members, memberById, loading, error, viewers, connected, actions]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export const useProject = () => useContext(ProjectContext);
