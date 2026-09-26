import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PROJECT_COLORS } from '../lib/constants';

/** Shared form fields for creating and editing a project. */
export default function ProjectFields({ value, onChange, autoFocus, disabled }) {
  const { t } = useTranslation();
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <div>
          <label className="label" htmlFor="project-name">
            {t('projects.name')}
          </label>
          <input id="project-name" className="input" value={value.name} onChange={set('name')} maxLength={80} autoFocus={autoFocus} required />
        </div>
        <div>
          <label className="label" htmlFor="project-key">
            {t('projects.key')}
          </label>
          <input
            id="project-key"
            className="input uppercase"
            value={value.key}
            onChange={(e) => onChange({ ...value, key: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() })}
            maxLength={6}
            placeholder="WEB"
            aria-describedby="project-key-hint"
          />
        </div>
      </div>
      <p id="project-key-hint" className="-mt-2 text-xs text-muted">
        {t('projects.keyHint')}
      </p>
      <div>
        <label className="label" htmlFor="project-description">
          {t('projects.description')}
        </label>
        <textarea id="project-description" className="input min-h-[80px] resize-y" value={value.description} onChange={set('description')} maxLength={500} />
      </div>
      <div>
        <span className="label">{t('projects.color')}</span>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, color })}
              className={clsx('flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110', value.color === color && 'ring-2 ring-offset-2 ring-offset-surface')}
              style={{ background: color, '--tw-ring-color': color }}
              aria-label={color}
            >
              {value.color === color && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
