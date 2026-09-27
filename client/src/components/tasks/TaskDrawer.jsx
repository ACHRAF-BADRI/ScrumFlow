import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, Link2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { formatDateTime, isOverdue, relativeTime, taskKey, toDateInput } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge, LabelChip } from '../ui/Badge';
import { useConfirm } from '../ui/Confirm';
import { Drawer } from '../ui/Modal';
import { EmptyState } from '../ui/Feedback';
import { CommentText, MentionTextarea } from './Mentions';
import Checklist from './Checklist';
import ActivityItem from '../activity/ActivityItem';
import Tooltip from '../ui/Tooltip';
import { AssigneePicker, PointsPicker, PriorityPicker, SprintPicker, StatusPicker, TypePicker } from './Pickers';

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-2 sm:grid-cols-[8.5rem_1fr]">
      <span className="text-sm text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function LabelsInput({ value = [], onChange }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const add = () => {
    const label = draft.trim().replace(/^#/, '');
    if (label && !value.includes(label)) onChange([...value, label]);
    setDraft('');
  };
  return (
    <div className="flex min-h-[36px] flex-wrap items-center gap-1 rounded-lg border border-transparent px-2 py-1 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 hover:border-line">
      {value.map((label) => (
        <LabelChip key={label} onRemove={() => onChange(value.filter((l) => l !== label))}>
          {label}
        </LabelChip>
      ))}
      <input
        className="min-w-[6rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/60"
        value={draft}
        placeholder={t('task.labelsPlaceholder')}
        maxLength={30}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() && add()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

function Comments({ task }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addComment, deleteComment, canManage, members } = useProject();
  const others = members.filter((m) => m._id !== user?._id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await addComment(task._id, text.trim());
      setText('');
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
    }
  };

  const comments = [...(task.comments ?? [])].reverse();

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="card focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <MentionTextarea
          className="block min-h-[72px] w-full resize-none bg-transparent px-3.5 py-3 text-sm outline-none placeholder:text-muted/60"
          placeholder={t('task.commentPlaceholder')}
          value={text}
          maxLength={2000}
          onChange={setText}
          members={others}
          onSubmitShortcut={submit}
        />
        <div className="flex items-center justify-between rounded-b-xl border-t border-line bg-surface-2/50 px-3 py-2">
          <span className="text-[11px] text-muted">{t('task.mentionHint')} · Ctrl + Enter</span>
          <button type="submit" className="btn-primary px-3 py-1.5" disabled={sending || !text.trim()}>
            <Send className="h-3.5 w-3.5" />
            {t('task.send')}
          </button>
        </div>
      </form>

      {comments.length === 0 && <EmptyState compact illustration="comments" title={t('task.noComments')} />}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c._id} className="group flex gap-3">
            <Avatar user={c.author} size="md" />
            <div className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{c.author?.name}</span>
                <Tooltip label={formatDateTime(c.createdAt)}>
                  <span className="text-xs text-muted">{relativeTime(c.createdAt)}</span>
                </Tooltip>
                {(c.author?._id === user?._id || canManage) && (
                  <button
                    type="button"
                    className="ml-auto text-muted opacity-0 transition hover:text-[#e2445c] group-hover:opacity-100"
                    onClick={() => deleteComment(task._id, c._id).catch(toastError)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                <CommentText text={c.text} members={members} />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskHistory({ task }) {
  const { t } = useTranslation();
  const { loadTaskActivity } = useProject();
  const [items, setItems] = useState(null);

  // Reload when the task changes (edits, checklist, comments)
  useEffect(() => {
    let cancelled = false;
    loadTaskActivity(task._id)
      .then((list) => !cancelled && setItems(list))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [loadTaskActivity, task._id, task.updatedAt]);

  if (items === null) return <p className="py-6 text-center text-sm text-muted">{t('common.loading')}</p>;
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{t('activity.emptyTask')}</p>;
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item._id}>
          <ActivityItem activity={item} compact />
        </li>
      ))}
    </ol>
  );
}

export default function TaskDrawer({ taskId, onClose }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { project, tasks, updateTask, deleteTask, canManage, loading } = useProject();
  const task = tasks.find((x) => x._id === taskId);

  const [title, setTitle] = useState('');
  const [panel, setPanel] = useState('updates');
  const [description, setDescription] = useState('');
  useEffect(() => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
  }, [task?._id, task?.title, task?.description]);

  // Deep link to a task that no longer exists
  useEffect(() => {
    if (taskId && !loading && project && !task) {
      toast.error(t('errors.taskNotFound'));
      onClose();
    }
  }, [taskId, task, loading, project, onClose, t]);

  if (!task) return null;

  const update = (changes) => updateTask(task._id, changes);
  const canDelete = canManage || task.reporter?._id === user?._id;
  const key = taskKey(project, task);

  const remove = async () => {
    const ok = await confirm({ title: t('common.delete'), message: t('task.deleteConfirm'), danger: true, confirmLabel: t('common.delete') });
    if (!ok) return;
    onClose();
    if (await deleteTask(task._id)) toast.success(t('task.deleted'));
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success(key);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      header={
        <div className="flex items-center gap-2">
          <TypePicker variant="icon" value={task.type} onChange={(type) => update({ type })} />
          <span className="font-mono text-sm font-semibold text-muted">{key}</span>
          {isOverdue(task) && <Badge color="#e2445c">{t('task.overdue')}</Badge>}
          <div className="ml-auto flex items-center">
            <Tooltip label={t('task.copyLink')} side="bottom">
              <button type="button" className="btn-icon" onClick={copyLink}>
                <Link2 className="h-4 w-4" />
              </button>
            </Tooltip>
            {canDelete && (
              <Tooltip label={t('common.delete')} side="bottom">
                <button type="button" className="btn-icon hover:text-[#e2445c]" onClick={remove}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6 px-4 py-5 sm:px-6">
        <textarea
          className="-mx-2 block w-[calc(100%+1rem)] resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold outline-none transition hover:border-line focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-2xl"
          rows={Math.min(4, Math.ceil((title.length || 1) / 40))}
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
          onBlur={() => {
            const next = title.trim();
            if (next && next !== task.title) update({ title: next });
            else setTitle(task.title);
          }}
        />

        <div className="space-y-1">
          <Field label={t('task.status')}>
            <StatusPicker value={task.status} onChange={(status) => update({ status })} />
          </Field>
          <Field label={t('task.assignee')}>
            <AssigneePicker value={task.assignee?._id ?? null} onChange={(assignee) => update({ assignee })} />
          </Field>
          <Field label={t('task.priority')}>
            <PriorityPicker value={task.priority} onChange={(priority) => update({ priority })} />
          </Field>
          <Field label={t('task.sprint')}>
            <SprintPicker value={task.sprint} onChange={(sprint) => update({ sprint })} />
          </Field>
          <Field label={t('task.points')}>
            <PointsPicker value={task.points} onChange={(points) => update({ points })} />
          </Field>
          <Field label={t('task.dueDate')}>
            <label className="flex min-h-[36px] items-center gap-2 rounded-lg border border-transparent px-2.5 transition focus-within:border-brand hover:border-line hover:bg-surface-2">
              <CalendarDays className="h-4 w-4 text-muted" />
              <input
                type="date"
                className="flex-1 bg-transparent py-1.5 text-sm outline-none"
                value={toDateInput(task.dueDate)}
                onChange={(e) => update({ dueDate: e.target.value || null })}
              />
            </label>
          </Field>
          <Field label={t('task.labels')}>
            <LabelsInput value={task.labels} onChange={(labels) => update({ labels })} />
          </Field>
        </div>

        <div>
          <h3 className="label">{t('task.description')}</h3>
          <textarea
            className="input min-h-[120px] resize-y leading-relaxed"
            placeholder={t('task.descriptionPlaceholder')}
            value={description}
            maxLength={5000}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== task.description && update({ description })}
          />
        </div>

        <Checklist task={task} />

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            {t('task.reporter')}: <Avatar user={task.reporter} size="xs" /> {task.reporter?.name}
          </span>
          <span>
            {t('task.createdAt')}: {formatDateTime(task.createdAt)}
          </span>
        </p>

        <div className="border-t border-line pt-5">
          <div className="mb-3 flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist">
            {[
              ['updates', `${t('task.activity')} (${task.comments?.length ?? 0})`],
              ['history', t('activity.history')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={panel === id}
                onClick={() => setPanel(id)}
                className={clsx('flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition', panel === id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
          {panel === 'updates' ? <Comments task={task} /> : <TaskHistory task={task} />}
        </div>
      </div>
    </Drawer>
  );
}
