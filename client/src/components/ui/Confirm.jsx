import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

const ConfirmContext = createContext(null);

/** `const ok = await confirm({ title, message, danger })` */
export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setState(options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => settle(false)}
        title={state?.title ?? t('common.confirm')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => settle(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className={state?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => settle(true)} autoFocus>
              {state?.confirmLabel ?? t('common.confirm')}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
