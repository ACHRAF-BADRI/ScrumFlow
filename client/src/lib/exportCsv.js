import { taskKey } from './format';

const cell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote everything that could break a column; a leading = + - @ is neutralised for spreadsheet safety
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) || safe !== text ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Tasks as CSV text (header + one row per task), ready for Excel or Google Sheets. */
export function tasksToCsv({ tasks, project, sprints, statusMap, t }) {
  const sprintName = (id) => sprints.find((s) => s._id === id)?.name ?? t('common.backlog');
  const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const columns = [
    [t('csv.key'), (task) => taskKey(project, task)],
    [t('task.title'), (task) => task.title],
    [t('task.type'), (task) => t(`type.${task.type}`)],
    [t('task.status'), (task) => statusMap[task.status]?.name ?? task.status],
    [t('task.priority'), (task) => t(`priority.${task.priority}`)],
    [t('task.points'), (task) => task.points ?? 0],
    [t('task.assignee'), (task) => task.assignee?.name ?? ''],
    [t('task.sprint'), (task) => sprintName(task.sprint)],
    [t('task.labels'), (task) => (task.labels ?? []).join(', ')],
    [t('task.dueDate'), (task) => iso(task.dueDate)],
    [t('csv.completedAt'), (task) => iso(task.completedAt)],
    [t('task.createdAt'), (task) => iso(task.createdAt)],
    [t('task.description'), (task) => task.description ?? ''],
  ];
  const lines = [columns.map(([name]) => cell(name)).join(',')];
  for (const task of tasks) lines.push(columns.map(([, get]) => cell(get(task))).join(','));
  return lines.join('\r\n');
}

/** Starts a download of `text` as a file (UTF-8 with BOM so Excel reads accents). */
export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
