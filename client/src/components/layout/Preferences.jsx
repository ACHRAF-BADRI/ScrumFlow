import clsx from 'clsx';
import { Check, Languages, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LANGUAGES } from '../../i18n';
import { Avatar } from '../ui/Avatar';
import { Popover } from '../ui/Popover';
import Tooltip from '../ui/Tooltip';

export function ThemeToggle({ className }) {
  const { t } = useTranslation();
  const { isDark, setTheme } = useTheme();
  const { updateProfile } = useAuth();
  const next = isDark ? 'light' : 'dark';
  return (
    <Tooltip label={t(`nav.${next}`)} side="bottom">
      <button
        type="button"
        className={clsx('btn-icon', className)}
        onClick={() => {
          setTheme(next);
          updateProfile({ theme: next });
        }}
        aria-label={t('nav.theme')}
      >
        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>
    </Tooltip>
  );
}

export function LanguageSwitcher({ className }) {
  const { t, i18n } = useTranslation();
  const { updateProfile } = useAuth();
  const current = i18n.language?.slice(0, 2);

  return (
    <Popover
      align="end"
      trigger={({ toggle, ref }) => (
        <button ref={ref} type="button" onClick={toggle} className={clsx('btn-ghost px-2.5', className)} aria-label={t('nav.language')}>
          <Languages className="h-[18px] w-[18px]" />
          <span className="text-xs font-bold uppercase">{current}</span>
        </button>
      )}
    >
      {({ close }) =>
        LANGUAGES.map((lng) => (
          <button
            key={lng.code}
            type="button"
            className="menu-item"
            onClick={() => {
              i18n.changeLanguage(lng.code);
              updateProfile({ language: lng.code });
              close();
            }}
          >
            <span className="flex h-5 w-7 items-center justify-center rounded bg-surface-2 text-[10px] font-bold uppercase text-muted">{lng.code}</span>
            {lng.label}
            {current === lng.code && <Check className="ml-auto h-4 w-4 text-brand" />}
          </button>
        ))
      }
    </Popover>
  );
}

const THEME_OPTIONS = [
  { id: 'light', icon: Sun },
  { id: 'dark', icon: Moon },
  { id: 'system', icon: Monitor },
];

export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  if (!user) return null;

  return (
    <Popover
      align="end"
      width={240}
      trigger={({ toggle, ref }) => (
        <button ref={ref} type="button" onClick={toggle} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
          <Avatar user={user} size="md" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="my-1.5 border-t border-line" />
          <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('nav.theme')}</p>
          <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
            {THEME_OPTIONS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTheme(id);
                  updateProfile({ theme: id });
                }}
                className={clsx(
                  'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-semibold transition',
                  theme === id ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-ink'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`nav.${id}`)}
              </button>
            ))}
          </div>
          <div className="my-1.5 border-t border-line" />
          <button
            type="button"
            className="menu-item text-[#e2445c]"
            onClick={() => {
              close();
              logout();
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </>
      )}
    </Popover>
  );
}
