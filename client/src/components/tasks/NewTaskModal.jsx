import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { taskKey } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { MarkdownEditor } from '../ui/Markdown';
import { useTemplates } from './Templates';
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
  checklist: [],
  ...defaults,
});

/** `defaults` pre-fills fields, e.g. { sprint } when adding from a sprint group. */
export default function NewTaskModal({ open, onClose, defaults }) {
  const { t } = useTranslation();
  const { project, createTask, members } = useProject();
  const templates = useTemplates();
  const [form, setForm] = useState(() => blank(defaults));
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(defaults));
      setTemplateId('');
    }
  }, [open, defaults]);

  // Fill the form from a template, keeping where the task was opened from (sprint, status)
  const applyTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((x) => x._id === id);
    if (!tpl) return setForm(blank(defaults));
    const assignee = tpl.assignee && members.some((m) => m._id === tpl.assignee) ? tpl.assignee : null;
    setForm(
      blank({
        title: tpl.title,
        description: tpl.description,
        type: tpl.type,
        priority: tpl.priority,
        points: tpl.points,
        labels: tpl.labels,
        checklist: tpl.checklist,
        assignee,
        ...defaults,
      })
    );
  };

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
        {templates.length > 0 && (
          <div>
            <label className="label" htmlFor="task-template">
              {t('templates.useOne')}
            </label>
            <select id="task-template" className="input" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">{t('templates.noTemplate')}</option>
              {templates.map((tpl) => (
                <option key={tpl._id} value={tpl._id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <MarkdownEditor id="task-description" minHeight={100} value={form.description} onChange={set('description')} members={members} placeholder={t('task.descriptionPlaceholder')} />
        </div>
        {form.checklist.length > 0 && (
          <div>
            <span className="label">{t('checklist.title')}</span>
            <ul className="space-y-1 rounded-lg border border-line p-2 text-sm">
              {form.checklist.map((item, i) => (
                <li key={`${item}-${i}`} className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded border border-line" />
                  <span className="min-w-0 flex-1 truncate">{item}</span>
                  <button type="button" className="text-xs text-muted hover:text-[#e2445c]" onClick={() => set('checklist')(form.checklist.filter((_, j) => j !== i))}>
                    {t('common.delete')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
