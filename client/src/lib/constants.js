import { Bookmark, Bug, CheckSquare, Zap } from 'lucide-react';

// Priority and type palette. Labels are i18n keys resolved in components.
// Statuses are per project: see hooks/useStatuses.js.

export const PRIORITIES = [
  { id: 'low', color: '#579bfc' },
  { id: 'medium', color: '#5559df' },
  { id: 'high', color: '#401694' },
  { id: 'critical', color: '#e2445c' },
];

export const TYPES = [
  { id: 'story', color: '#00c875', icon: Bookmark },
  { id: 'task', color: '#579bfc', icon: CheckSquare },
  { id: 'bug', color: '#e2445c', icon: Bug },
  { id: 'epic', color: '#a25ddc', icon: Zap },
];

export const STORY_POINTS = [0, 1, 2, 3, 5, 8, 13, 21];

export const PROJECT_COLORS = ['#6161ff', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc', '#ff642e', '#037f4c', '#ff158a', '#333333'];

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));
export const PRIORITY_MAP = byId(PRIORITIES);
export const TYPE_MAP = byId(TYPES);

export const MANAGER_ROLES = ['owner', 'admin'];
