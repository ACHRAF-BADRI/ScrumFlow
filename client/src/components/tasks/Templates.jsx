import { useEffect, useState } from 'react';
import { CopyPlus, LayoutTemplate, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { useConfirm } from '../ui/Confirm';
import { TypeIcon } from '../ui/Badge';
import Tooltip from '../ui/Tooltip';
import { LabelsInput } from './TaskDrawer';
import { AssigneePicker, PointsPicker, PriorityPicker, TypePicker } from './Pickers';

const FREQUENCIES = ['none', 'daily', 'weekly', 'monthly'];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const blank = (initial) => ({
  name: '',
  title: '',
  description: '',
  type: 'task',
  priority: 'medium',
  points: 0,
  assignee: null,
  labels: [],
  checklist: [],
  ...initial,
  repeat: { frequency: 'none', weekday: 1, monthDay: 1, target: 'sprint', ...initial?.repeat },
});

export const useTemplates = () => useProject().project?.templates ?? [];

/** Create or edit a template. `template` with an _id edits it; without, it pre-fills a new one. */
export function TemplateModal({ open, onClose, template }) {
  const { t, i18n } = useTranslation();
  const { createTemplate, updateTemplate } = useProject();
  const [form, setForm] = useState(() => blank(template));
  const [checklistText, setChecklistText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = blank(template ? { ...template, assignee: template.assignee?._id ?? template.assignee ?? null } : undefined);
    setForm(next);
    setChecklistText(next.checklist.join('\n'));
  }, [open, template]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const setRepeat = (changes) => setForm((f) => ({ ...f, repeat: { ...f.repeat, ...changes } }));
  const weekday = (d) => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(new Date(2026, 0, 4 + d)); // 4 Jan 2026 is a Sunday

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, checklist: checklistText.split('\n').map((l) => l.trim()).filter(Boolean) };
    try {
      if (template?._id) await updateTemplate(template._id, payload);
      else await createTemplate(payload);
      toast.success(t('templates.saved'));
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const bordered = (control) => <div className="rounded-lg border border-line">{control}</div>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={template?._id ? t('templates.edit') : t('templates.new')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="template-form" className="btn-primary" disabled={saving || !form.name.trim() || !form.title.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="tpl-name">
              {t('templates.name')}
            </label>
            <input id="tpl-name" className="input" value={form.name} maxLength={60} placeholder={t('templates.namePlaceholder')} onChange={(e) => set('name')(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="tpl-title">
              {t('templates.taskTitle')}
            </label>
            <input id="tpl-title" className="input" value={form.title} maxLength={200} placeholder={t('task.titlePlaceholder')} onChange={(e) => set('title')(e.target.value)} />
          </div>
          <div>
            <span className="label">{t('task.type')}</span>
            {bordered(<TypePicker value={form.type} onChange={set('type')} />)}
          </div>
          <div>
            <span className="label">{t('task.priority')}</span>
            {bordered(<PriorityPicker value={form.priority} onChange={set('priority')} />)}
          </div>
          <div>
            <span className="label">{t('task.assignee')}</span>
            {bordered(<AssigneePicker value={form.assignee} onChange={set('assignee')} />)}
          </div>
          <div>
            <span className="label">{t('task.points')}</span>
            {bordered(<PointsPicker value={form.points} onChange={set('points')} />)}
          </div>
          <div className="sm:col-span-2">
            <span className="label">{t('task.labels')}</span>
            {bordered(<LabelsInput value={form.labels} onChange={set('labels')} />)}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tpl-description">
            {t('task.description')}
          </label>
          <textarea id="tpl-description" className="input min-h-[80px] resize-y" value={form.description} maxLength={5000} onChange={(e) => set('description')(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="tpl-checklist">
            {t('templates.checklist')}
          </label>
          <textarea
            id="tpl-checklist"
            className="input min-h-[80px] resize-y"
            value={checklistText}
            placeholder={t('templates.checklistPlaceholder')}
            onChange={(e) => setChecklistText(e.target.value)}
          />
        </div>

        <fieldset className="rounded-xl border border-line p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted">
            <Repeat className="h-3.5 w-3.5" /> {t('templates.repeat')}
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input h-9 w-auto py-0" value={form.repeat.frequency} onChange={(e) => setRepeat({ frequency: e.target.value })} aria-label={t('templates.repeat')}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`templates.freq.${f}`)}
                </option>
              ))}
            </select>
            {form.repeat.frequency === 'weekly' && (
              <select className="input h-9 w-auto py-0" value={form.repeat.weekday} onChange={(e) => setRepeat({ weekday: Number(e.target.value) })} aria-label={t('templates.weekday')}>
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {weekday(d)}
                  </option>
                ))}
              </select>
            )}
            {form.repeat.frequency === 'monthly' && (
              <select className="input h-9 w-auto py-0" value={form.repeat.monthDay} onChange={(e) => setRepeat({ monthDay: Number(e.target.value) })} aria-label={t('templates.monthDay')}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {t('templates.dayOfMonth', { day: d })}
                  </option>
                ))}
              </select>
            )}
            {form.repeat.frequency !== 'none' && (
              <select className="input h-9 w-auto py-0" value={form.repeat.target} onChange={(e) => setRepeat({ target: e.target.value })} aria-label={t('templates.target')}>
                <option value="sprint">{t('templates.toSprint')}</option>
                <option value="backlog">{t('templates.toBacklog')}</option>
              </select>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">{form.repeat.frequency === 'none' ? t('templates.repeatNone') : t('templates.repeatHint')}</p>
        </fieldset>
      </form>
    </Modal>
  );
}

/** Templates list in Team & settings. Every member can add one. */
export function TemplatesCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { canManage, deleteTemplate } = useProject();
  const templates = useTemplates();
  const [editing, setEditing] = useState(null); // null closed, {} new, template

  const remove = async (tpl) => {
    const ok = await confirm({ title: t('templates.delete'), message: t('templates.deleteConfirm', { name: tpl.name }), danger: true, confirmLabel: t('common.delete') });
    if (!ok) return;
    try {
      await deleteTemplate(tpl._id);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 text-sm font-bold">
          <LayoutTemplate className="h-4 w-4 text-brand" /> {t('templates.title')}
        </h3>
        <button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" /> {t('templates.add')}
        </button>
      </div>
      <p className="mb-3 mt-1 text-xs text-muted">{t('templates.text')}</p>
      {templates.length === 0 ? (
        <p className="rounded-lg bg-surface-2/60 px-3 py-4 text-center text-xs text-muted">{t('templates.empty')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {templates.map((tpl) => {
            const editable = canManage || String(tpl.createdBy) === user._id;
            return (
              <li key={tpl._id} className="flex items-center gap-2.5 px-3 py-2.5">
                <TypeIcon type={tpl.type} className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{tpl.name}</p>
                  <p className="truncate text-xs text-muted">
                    {tpl.repeat?.frequency && tpl.repeat.frequency !== 'none' ? (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <Repeat className="h-3 w-3" /> {t(`templates.freq.${tpl.repeat.frequency}`)}
                        {tpl.repeat.nextRun && `, ${t('templates.next', { date: formatDateTime(tpl.repeat.nextRun) })}`}
                      </span>
                    ) : (
                      tpl.title
                    )}
                  </p>
                </div>
                {editable && (
                  <>
                    <Tooltip label={t('common.edit')}>
                      <button type="button" className="btn-icon h-8 w-8" onClick={() => setEditing(tpl)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip label={t('common.delete')}>
                      <button type="button" className="btn-icon h-8 w-8 hover:text-[#e2445c]" onClick={() => remove(tpl)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <TemplateModal open={editing !== null} template={editing?._id ? editing : null} onClose={() => setEditing(null)} />
    </section>
  );
}

/** "Save as template" button of the task drawer. */
export function SaveAsTemplateButton({ task }) {
  const { t } = useTranslation();
  // Captured once when opened, so re-renders of the drawer don't reset the form
  const [initial, setInitial] = useState(null);
  const open = () =>
    setInitial({
      name: task.title.slice(0, 60),
      title: task.title,
      description: task.description,
      type: task.type === 'epic' ? 'task' : task.type,
      priority: task.priority,
      points: task.points,
      assignee: task.assignee?._id ?? null,
      labels: task.labels ?? [],
      checklist: (task.checklist ?? []).map((i) => i.text),
    });
  return (
    <>
      <Tooltip label={t('templates.saveFromTask')} side="bottom">
        <button type="button" className="btn-icon" onClick={open} aria-label={t('templates.saveFromTask')}>
          <CopyPlus className="h-4 w-4" />
        </button>
      </Tooltip>
      <TemplateModal open={initial !== null} template={initial} onClose={() => setInitial(null)} />
    </>
  );
}
