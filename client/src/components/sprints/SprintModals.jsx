import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { toDateInput } from '../../lib/format';
import { Modal } from '../ui/Modal';

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

/**
 * mode: "create" | "edit" | "start"
 * Starting a sprint lets the team confirm goal and dates, like Jira does.
 */
export function SprintModal({ open, mode, sprint, onClose }) {
  const { t } = useTranslation();
  const { sprints, createSprint, updateSprint, startSprint } = useProject();
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = sprint?.startDate ? new Date(sprint.startDate) : new Date();
    const end = sprint?.endDate ? new Date(sprint.endDate) : new Date(start.getTime() + TWO_WEEKS);
    setForm({
      name: sprint?.name ?? `Sprint ${sprints.length + 1}`,
      goal: sprint?.goal ?? '',
      startDate: mode === 'create' && !sprint ? '' : toDateInput(start),
      endDate: mode === 'create' && !sprint ? '' : toDateInput(end),
    });
  }, [open, mode, sprint, sprints.length]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const invalidDates = form.startDate && form.endDate && form.endDate < form.startDate;

  const submit = async (e) => {
    e.preventDefault();
    if (invalidDates) return;
    setSaving(true);
    const payload = { ...form, startDate: form.startDate || null, endDate: form.endDate || null };
    try {
      if (mode === 'create') {
        await createSprint(payload);
        toast.success(t('sprint.created'));
      } else if (mode === 'edit') {
        await updateSprint(sprint._id, payload);
        toast.success(t('sprint.updated'));
      } else {
        if (form.name !== sprint.name) await updateSprint(sprint._id, { name: form.name });
        const started = await startSprint(sprint._id, payload);
        toast.success(t('sprint.started', { name: started.name }));
      }
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const title = { create: t('sprint.new'), edit: t('sprint.edit'), start: t('sprint.start') }[mode];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="sprint-form" className="btn-primary" disabled={saving || invalidDates || !form.name.trim()}>
            {saving ? t('common.saving') : mode === 'start' ? t('sprint.start') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="sprint-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="sprint-name">
            {t('sprint.name')}
          </label>
          <input id="sprint-name" className="input" value={form.name} onChange={set('name')} maxLength={80} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="sprint-goal">
            {t('sprint.goal')}
          </label>
          <textarea id="sprint-goal" className="input min-h-[72px] resize-y" placeholder={t('sprint.goalPlaceholder')} value={form.goal} onChange={set('goal')} maxLength={300} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sprint-start">
              {t('sprint.startDate')}
            </label>
            <input id="sprint-start" type="date" className="input" value={form.startDate} onChange={set('startDate')} required={mode === 'start'} />
          </div>
          <div>
            <label className="label" htmlFor="sprint-end">
              {t('sprint.endDate')}
            </label>
            <input
              id="sprint-end"
              type="date"
              className={clsx('input', invalidDates && 'border-[#e2445c]')}
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={set('endDate')}
              required={mode === 'start'}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function CompleteSprintModal({ open, sprint, onClose }) {
  const { t } = useTranslation();
  const { tasks, sprints, completeSprint, project } = useProject();
  const navigate = useNavigate();
  const projectId = project?._id;
  const [moveTo, setMoveTo] = useState('backlog');
  const [saving, setSaving] = useState(false);

  const planned = useMemo(() => sprints.filter((s) => s.status === 'planned'), [sprints]);
  const sprintTasks = tasks.filter((task) => task.sprint === sprint?._id);
  const done = sprintTasks.filter((task) => task.completedAt).length;
  const openCount = sprintTasks.length - done;

  useEffect(() => {
    if (open) setMoveTo(planned[0]?._id ?? 'backlog');
  }, [open, planned]);

  const submit = async () => {
    setSaving(true);
    try {
      await completeSprint(sprint._id, moveTo);
      toast.success(t('sprint.completedToast', { name: sprint.name }), {
        action: { label: t('retro.open'), onClick: () => navigate(`/projects/${projectId}/retro/${sprint._id}`) },
      });
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  if (!sprint) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sprint.completeTitle', { name: sprint.name })}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? t('common.saving') : t('sprint.complete')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#00c875]/10 p-3 text-center">
            <p className="text-2xl font-extrabold text-[#00c875]">{done}</p>
            <p className="text-xs font-semibold text-muted">{t('status.done')}</p>
          </div>
          <div className="rounded-xl bg-[#fdab3d]/10 p-3 text-center">
            <p className="text-2xl font-extrabold text-[#fdab3d]">{openCount}</p>
            <p className="text-xs font-semibold text-muted">{t('status.todo')} / {t('status.in_progress')}</p>
          </div>
        </div>
        <p className="text-sm text-muted">{t('sprint.completeSummary', { done, open: openCount })}</p>
        {openCount > 0 && (
          <div>
            <label className="label" htmlFor="move-to">
              {t('sprint.moveOpenTo')}
            </label>
            <select id="move-to" className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {planned.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
              <option value="backlog">{t('common.backlog')}</option>
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
