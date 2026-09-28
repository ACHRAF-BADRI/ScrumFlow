import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Round button that appears after scrolling down a screen and a half, and goes back to the top. */
export default function BackToTop() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVisible(window.scrollY > window.innerHeight * 1.5));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const up = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={up}
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      tabIndex={visible ? 0 : -1}
      data-testid="back-to-top"
      className={clsx(
        'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-pop transition duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:right-6 print:hidden',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
