import i18n from '../i18n';

const locale = () => (i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US');

export function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale(), options).format(new Date(value));
}

export function formatDateTime(value) {
  return formatDate(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return rtf.format(Math.round(diff), 'second');
}

/** Value for <input type="date"> from an ISO date. */
export const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export function daysLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

export const isOverdue = (task) => task.dueDate && !task.completedAt && new Date(task.dueDate) < new Date(new Date().toDateString());

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const taskKey = (project, task) => `${project?.key ?? ''}-${task.number}`;
