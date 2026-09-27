import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { taskKey } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { LabelsInput } from './TaskDrawer';
import { EpicPicker } from './Epics';
import { AssigneePicker, PointsPicker, PriorityPicker, SprintPicker, StatusPicker, TypePicker } from './Pickers';

const blank = (defaults) => ({
  title: '',
  description: '',
  type: 'task',
  status: 'todo',
  priority: 'medium',
  points: 0,
  assignee: null,
  sprint: null,
  epic: null,
  dueDate: '',
  labels: [],
  ...defaults,
});

/** `defaults` pre-fills fields, e.g. { sprint } when adding from a sprint group. */
export default function NewTaskModal({ open, onClose, defaults }) {
  const { t } = useTranslation();
  const { project, createTask } = useProject();
  const [form, setForm] = useState(() => blank(defaults));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(blank(defaults));
  }, [open, defaults]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const task = await createTask({ ...form, dueDate: form.dueDate || null });
      toast.success(t('task.created', { key: taskKey(project, task) }));
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('task.new')}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="new-task" className="btn-primary" disabled={saving || !form.title.trim()}>
            {saving ? t('common.saving') : t('common.create')}
          </button>
        </>
      }
    >
      <form id="new-task" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="task-title">
            {t('task.title')}
          </label>
          <input
            id="task-title"
            className="input text-base"
            placeholder={t('task.titlePlaceholder')}
            value={form.title}
            maxLength={200}
            onChange={(e) => set('title')(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {[
            ['task.type', <TypePicker key="type" value={form.type} onChange={set('type')} />],
            ['task.status', <StatusPicker key="status" value={form.status} onChange={set('status')} />],
            ['task.priority', <PriorityPicker key="priority" value={form.priority} onChange={set('priority')} />],
            ['task.assignee', <AssigneePicker key="assignee" value={form.assignee} onChange={set('assignee')} />],
            ['task.sprint', <SprintPicker key="sprint" value={form.sprint} onChange={set('sprint')} />],
            ['task.points', <PointsPicker key="points" value={form.points} onChange={set('points')} />],
            ...(form.type !== 'epic' ? [['epics.epic', <EpicPicker key="epic" value={form.epic} onChange={set('epic')} />]] : []),
          ].map(([label, control]) => (
            <div key={label}>
              <span className="label">{t(label)}</span>
              <div className="rounded-lg border border-line">{control}</div>
            </div>
          ))}
          <div>
            <label className="label" htmlFor="task-due">
              {t('task.dueDate')}
            </label>
            <input id="task-due" type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate')(e.target.value)} />
          </div>
          <div>
            <span className="label">{t('task.labels')}</span>
            <div className="rounded-lg border border-line">
              <LabelsInput value={form.labels} onChange={set('labels')} />
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="task-description">
            {t('task.description')}
          </label>
          <textarea
            id="task-description"
            className="input min-h-[100px] resize-y"
            placeholder={t('task.descriptionPlaceholder')}
            value={form.description}
            maxLength={5000}
            onChange={(e) => set('description')(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
