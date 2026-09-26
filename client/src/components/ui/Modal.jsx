import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function useModalBehaviour(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

/** Centered dialog. Full-width sheet on small screens. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { t } = useTranslation();
  useModalBehaviour(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-2xl border border-line bg-surface shadow-pop sm:rounded-2xl',
          { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size]
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" className="btn-icon -mr-2 h-8 w-8" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Right side panel for item details. Full screen on mobile. */
export function Drawer({ open, onClose, children, header }) {
  const { t } = useTranslation();
  useModalBehaviour(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-2xl animate-slide-in flex-col border-l border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">{header}</div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
