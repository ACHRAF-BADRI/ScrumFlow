import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import ActivityItem from './activity/ActivityItem';
import { ChecklistBadge } from './tasks/Checklist';

describe('checklist badge', () => {
  test('shows progress, and nothing for an empty checklist', () => {
    const { container, rerender } = render(<ChecklistBadge checklist={[{ done: true }, { done: false }, { done: false }]} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    rerender(<ChecklistBadge checklist={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('turns green when complete', () => {
    render(<ChecklistBadge checklist={[{ done: true }, { done: true }]} />);
    expect(screen.getByText('2/2').className).toMatch(/00c875/);
  });
});

describe('activity sentences', () => {
  const base = { _id: '1', actor: { name: 'Nora', avatarColor: '#6161ff' }, taskKey: 'APO-1', taskTitle: 'Login page', createdAt: new Date().toISOString() };

  test('status change uses the saved custom label outside a project', () => {
    render(<ActivityItem activity={{ ...base, type: 'task.updated', data: { field: 'status', from: 'todo', to: 'shipped_ab12', toLabel: 'Shipped' } }} />);
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Nora moved APO-1 to Shipped')).toBeInTheDocument();
  });

  test('default statuses are translated', () => {
    render(<ActivityItem activity={{ ...base, type: 'task.updated', data: { field: 'status', to: 'done' } }} />);
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Nora moved APO-1 to Done')).toBeInTheDocument();
  });

  test('member events use the member name', () => {
    render(<ActivityItem activity={{ ...base, taskKey: undefined, type: 'member.joined', data: { name: 'Tom' } }} />);
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Tom joined the project')).toBeInTheDocument();
  });
});
