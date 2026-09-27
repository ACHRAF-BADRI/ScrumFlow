import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../context/ProjectContext';

/*
 * Project workflow on the client (same defaults as the API). Default statuses
 * have no stored label and are translated; custom ones use their own name.
 */
export const DEFAULT_STATUSES = [
  { key: 'todo', label: '', color: '#a1a3b8', category: 'todo' },
  { key: 'in_progress', label: '', color: '#fdab3d', category: 'in_progress' },
  { key: 'review', label: '', color: '#a25ddc', category: 'in_progress' },
  { key: 'stuck', label: '', color: '#e2445c', category: 'in_progress' },
  { key: 'done', label: '', color: '#00c875', category: 'done' },
];
export const CATEGORIES = ['todo', 'in_progress', 'done'];

export function resolveStatuses(list, t) {
  return (list?.length ? list : DEFAULT_STATUSES).map((s) => ({ ...s, name: s.label || t(`status.${s.key}`, { defaultValue: s.key }) }));
}

/**
 * Statuses of the current project (or of `statuses` when given, e.g. on
 * "My work" where tasks come from several projects).
 */
export function useStatuses(statuses) {
  const { t, i18n } = useTranslation();
  const ctx = useProject();
  const source = statuses ?? ctx?.project?.statuses;
  return useMemo(() => {
    const list = resolveStatuses(source, t);
    const map = Object.fromEntries(list.map((s) => [s.key, s]));
    return { list, map, isDone: (key) => map[key]?.category === 'done' };
    // i18n.language: names change with the language
  }, [source, t, i18n.language]);
}

/** A task is finished when the API set its completion date (status in the "done" category). */
export const isTaskDone = (task) => Boolean(task?.completedAt);
