import { describe, expect, test } from 'vitest';
import i18n from '../i18n';
import { DEFAULT_STATUSES, isTaskDone, resolveStatuses } from './useStatuses';

const t = i18n.t.bind(i18n);

describe('project statuses', () => {
  test('without a workflow, the 5 default statuses are used and translated', () => {
    const list = resolveStatuses(undefined, t);
    expect(list.map((s) => s.key)).toEqual(DEFAULT_STATUSES.map((s) => s.key));
    expect(list.find((s) => s.key === 'in_progress').name).toBe('Working on it');
  });

  test('custom names win over translations', () => {
    const list = resolveStatuses(
      [
        { key: 'todo', label: '', color: '#aaa', category: 'todo' },
        { key: 'review', label: 'QA', color: '#bbb', category: 'in_progress' },
        { key: 'shipped_ab12', label: 'Shipped', color: '#0c8', category: 'done' },
      ],
      t
    );
    expect(list.map((s) => s.name)).toEqual(['To do', 'QA', 'Shipped']);
  });

  test('a task is done when it has a completion date', () => {
    expect(isTaskDone({ completedAt: '2026-09-01T10:00:00Z' })).toBe(true);
    expect(isTaskDone({ completedAt: null })).toBe(false);
  });
});
