import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ListChecks, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../context/ProjectContext';
import { toastError } from '../../lib/api';
import { ProgressBar } from '../ui/Feedback';

/** "2/5" chip for table rows and board cards; green when everything is done. */
export function ChecklistBadge({ checklist }) {
  if (!checklist?.length) return null;
  const done = checklist.filter((i) => i.done).length;
  const complete = done === checklist.length;
  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', complete ? 'bg-[#00c875]/15 text-[#00a862] dark:text-[#3ddc97]' : 'bg-surface-2 text-muted')}>
      <ListChecks className="h-3 w-3" strokeWidth={2.4} />
      {done}/{checklist.length}
    </span>
  );
}

function Item({ task, item }) {
  const { t } = useTranslation();
  const { updateChecklistItem, removeChecklistItem } = useProject();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  const save = () => {
    const value = text.trim();
    setEditing(false);
    if (!value) return setText(item.text);
    if (value !== item.text) updateChecklistItem(task._id, item._id, { text: value });
  };

  return (
    <li className="group/item flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        onClick={() => updateChecklistItem(task._id, item._id, { done: !item.done })}
        className={clsx(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition',
          item.done ? 'border-[#00c875] bg-[#00c875] text-white' : 'border-line hover:border-brand'
        )}
      >
        {item.done && <Check className="h-3 w-3" strokeWidth={3.5} />}
      </button>
      {editing ? (
        <input
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-brand bg-surface px-2 py-0.5 text-sm outline-none ring-2 ring-brand/20"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.stopPropagation(); // keep the task panel open
              setText(item.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={clsx('min-w-0 flex-1 truncate text-left text-sm', item.done && 'text-muted line-through decoration-muted/60')}>
          {item.text}
        </button>
      )}
      <button
        type="button"
        onClick={() => removeChecklistItem(task._id, item._id)}
        className="shrink-0 text-muted opacity-0 transition hover:text-[#e2445c] focus-visible:opacity-100 group-hover/item:opacity-100"
        aria-label={t('common.delete')}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

export default function Checklist({ task }) {
  const { t } = useTranslation();
  const { addChecklistItem } = useProject();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const items = task.checklist ?? [];
  const done = items.filter((i) => i.done).length;

  const add = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      await addChecklistItem(task._id, value);
      setText('');
      inputRef.current?.focus(); // keep adding in a row
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label mb-0 flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" /> {t('checklist.title')}
        </h3>
        {items.length > 0 && (
          <span className={clsx('text-xs font-semibold', done === items.length ? 'text-[#00c875]' : 'text-muted')}>
            {done}/{items.length}
          </span>
        )}
      </div>
      {items.length > 0 && <ProgressBar value={(done / items.length) * 100} className="mb-2" />}
      <ul className="-mx-2">
        {items.map((item) => (
          <Item key={item._id} task={task} item={item} />
        ))}
      </ul>
      <div className="-mx-2 mt-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 focus-within:bg-surface-2">
        <Plus className="h-[18px] w-[18px] shrink-0 text-muted" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/80"
          placeholder={t('checklist.add')}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
    </section>
  );
}
