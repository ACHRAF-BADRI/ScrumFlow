import crypto from 'crypto';
import { badRequest } from './httpError.js';

/*
 * Per-project workflow. Each status has a key (stored on tasks), an optional
 * custom label (default statuses are translated by the client), a color and a
 * category. The "done" category is what counts as finished: burndown,
 * velocity, "My work"… A task is done when its completedAt is set, and the
 * API keeps completedAt in sync with the category of its status.
 */
export const CATEGORIES = ['todo', 'in_progress', 'done'];

export const DEFAULT_STATUSES = [
  { key: 'todo', label: '', color: '#a1a3b8', category: 'todo' },
  { key: 'in_progress', label: '', color: '#fdab3d', category: 'in_progress' },
  { key: 'review', label: '', color: '#a25ddc', category: 'in_progress' },
  { key: 'stuck', label: '', color: '#e2445c', category: 'in_progress' },
  { key: 'done', label: '', color: '#00c875', category: 'done' },
];
const DEFAULT_KEYS = DEFAULT_STATUSES.map((s) => s.key);

/** Works with documents and lean objects (older projects have no statuses stored). */
export const statusesOf = (project) => (project?.statuses?.length ? project.statuses : DEFAULT_STATUSES);
export const hasStatus = (project, key) => statusesOf(project).some((s) => s.key === key);
export const isDoneStatus = (project, key) => statusesOf(project).some((s) => s.key === key && s.category === 'done');
export const statusLabel = (project, key) => statusesOf(project).find((s) => s.key === key)?.label || '';
/** Status given to new tasks: the first "to do" one. */
export const defaultStatus = (project) => (statusesOf(project).find((s) => s.category === 'todo') ?? statusesOf(project)[0]).key;

const HEX = /^#[0-9a-f]{6}$/i;
const KEY = /^[a-z0-9_-]{1,40}$/;
const slug = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24) || 'status';

/** Validates a workflow sent by the client and fills in keys for new statuses. */
export function sanitizeStatuses(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 12) {
    throw badRequest('A workflow needs between 2 and 12 statuses', 'errors.statusesCount');
  }
  const seen = new Set();
  const out = input.map((raw) => {
    const label = String(raw?.label ?? '').trim().slice(0, 30);
    let key = KEY.test(raw?.key ?? '') ? raw.key : `${slug(label)}_${crypto.randomBytes(2).toString('hex')}`;
    if (seen.has(key)) key = `${key}_${crypto.randomBytes(2).toString('hex')}`;
    seen.add(key);
    // Custom statuses have no translation, so they need a name
    if (!DEFAULT_KEYS.includes(key) && !label) throw badRequest('Every custom status needs a name', 'errors.statusName');
    return {
      key,
      label,
      color: HEX.test(raw?.color ?? '') ? raw.color : '#a1a3b8',
      category: CATEGORIES.includes(raw?.category) ? raw.category : 'in_progress',
    };
  });
  if (!out.some((s) => s.category === 'done') || !out.some((s) => s.category !== 'done')) {
    throw badRequest('Keep at least one "done" status and one that is not done', 'errors.statusesDone');
  }
  return out;
}
