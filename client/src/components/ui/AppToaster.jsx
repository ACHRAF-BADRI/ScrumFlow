import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { Toaster } from 'sonner';
import { useTheme } from '../../context/ThemeContext';

const TOAST_DURATION = 4000;

const icon = (Icon, spin) => <Icon className={spin ? 'h-[18px] w-[18px] animate-spin' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />;

/**
 * Sonner with our own look (see `.sf-toast` in index.css): a compact card
 * with a colored icon, the close button only shows on hover.
 */
export default function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="top-center"
      offset={20}
      gap={8}
      visibleToasts={4}
      duration={TOAST_DURATION}
      closeButton
      icons={{
        success: icon(CheckCircle2),
        error: icon(XCircle),
        warning: icon(AlertTriangle),
        info: icon(Info),
        loading: icon(Loader2, true),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'sf-toast',
          icon: 'sf-toast-icon',
          content: 'sf-toast-content',
          title: 'sf-toast-title',
          description: 'sf-toast-description',
          closeButton: 'sf-toast-close',
          actionButton: 'sf-toast-action',
          cancelButton: 'sf-toast-cancel',
          success: 'sf-toast--success',
          error: 'sf-toast--error',
          warning: 'sf-toast--warning',
          info: 'sf-toast--info',
          loading: 'sf-toast--loading',
          default: 'sf-toast--default',
        },
      }}
    />
  );
}
