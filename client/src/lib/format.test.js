import { describe, expect, test } from 'vitest';
import { daysLeft, initials, isOverdue, taskKey } from './format';

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('format helpers', () => {
  test('a task is overdue only when its date is past and it is not completed', () => {
    expect(isOverdue({ dueDate: day(-2), completedAt: null })).toBe(true);
    expect(isOverdue({ dueDate: day(-2), completedAt: new Date().toISOString() })).toBe(false);
    expect(isOverdue({ dueDate: day(3), completedAt: null })).toBe(false);
    expect(isOverdue({ dueDate: null })).toBeFalsy();
  });

  test('initials use the first two words', () => {
    expect(initials('Nora Lead')).toBe('NL');
    expect(initials('achraf el badri')).toBe('AE');
    expect(initials('')).toBe('');
  });

  test('task keys join the project key and the number', () => {
    expect(taskKey({ key: 'WEB' }, { number: 12 })).toBe('WEB-12');
  });

  test('days left counts the end day itself', () => {
    expect(daysLeft(new Date())).toBe(1);
    expect(daysLeft(null)).toBeNull();
  });
});
