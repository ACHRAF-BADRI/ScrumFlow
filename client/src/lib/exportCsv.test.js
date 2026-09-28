import { describe, expect, it } from 'vitest';
import { tasksToCsv } from './exportCsv';

const t = (key) => key;
const project = { key: 'APO' };

describe('tasksToCsv', () => {
  it('writes a header and quotes cells with commas, quotes or line breaks', () => {
    const csv = tasksToCsv({
      project,
      sprints: [{ _id: 's1', name: 'Sprint 1' }],
      statusMap: { todo: { name: 'To do' } },
      t,
      tasks: [{ number: 3, title: 'Pay, then "ship"', type: 'bug', status: 'todo', priority: 'high', points: 5, sprint: 's1', labels: ['a', 'b'], description: 'line 1\nline 2' }],
    });
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('csv.key,task.title')).toBe(true);
    expect(row).toContain('APO-3,"Pay, then ""ship""",type.bug,To do,priority.high,5,,Sprint 1,"a, b"');
    expect(row).toContain('"line 1\nline 2"');
  });

  it('neutralises formulas so a spreadsheet does not run them', () => {
    const csv = tasksToCsv({ project, sprints: [], statusMap: {}, t, tasks: [{ number: 1, title: '=HYPERLINK("x")', type: 'task', status: 'todo', priority: 'low' }] });
    expect(csv.split('\r\n')[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
