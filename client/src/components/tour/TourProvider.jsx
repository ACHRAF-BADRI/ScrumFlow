import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { TOURS } from '../../lib/tours';

const TourContext = createContext(null);
const PAD = 6; // space between the element and the spotlight edge
const GAP = 14; // space between the spotlight and the card
const MARGIN = 12; // minimum distance to the viewport edge

const findTarget = (target) => {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
};

/** Index of the next step (in `dir`) that can be shown, or -1 when there is none. */
function nextShowable(steps, from, dir) {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    if (!steps[i].target || findTarget(steps[i].target)) return i;
  }
  return -1;
}

export function TourProvider({ children }) {
  const { user, updateProfile } = useAuth();
  const [tourId, setTourId] = useState(null);
  const [index, setIndex] = useState(0);
  const steps = tourId ? TOURS[tourId] : null;

  const markDone = useCallback(
    (id) => {
      const done = new Set(user?.tours ?? []);
      done.add(id);
      updateProfile({ tours: [...done] });
    },
    [user?.tours, updateProfile]
  );

  const start = useCallback((id) => {
    const first = nextShowable(TOURS[id], 0, 1);
    if (first === -1) return;
    setIndex(first);
    setTourId(id);
  }, []);

  const finish = useCallback(() => {
    if (tourId) markDone(tourId);
    setTourId(null);
  }, [tourId, markDone]);

  const go = useCallback(
    (dir) => {
      const i = nextShowable(steps, index + dir, dir);
      if (i === -1) {
        if (dir > 0) finish();
        return;
      }
      setIndex(i);
    },
    [steps, index, finish]
  );

  /** Start `id` automatically once, if the user has never finished or skipped it. */
  const autoStart = useCallback(
    (id) => {
      if (!user || tourId || (user.tours ?? []).includes(id)) return;
      start(id);
    },
    [user, tourId, start]
  );

  /** Forget completed tours so they show again. */
  const replay = useCallback(
    (id) => {
      updateProfile({ tours: [] });
      start(id);
    },
    [updateProfile, start]
  );

  const value = useMemo(() => ({ active: Boolean(tourId), autoStart, replay }), [tourId, autoStart, replay]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {steps && (
        <TourOverlay
          tourId={tourId}
          step={steps[index]}
          position={steps.slice(0, index + 1).filter((s) => !s.target || findTarget(s.target)).length}
          total={steps.filter((s) => !s.target || findTarget(s.target)).length}
          isFirst={nextShowable(steps, index - 1, -1) === -1}
          isLast={nextShowable(steps, index + 1, 1) === -1}
          onNext={() => go(1)}
          onBack={() => go(-1)}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}

export const useTour = () => useContext(TourContext);

/** Starts the tour once `ready` is true (data loaded, elements rendered). */
export function useAutoTour(id, ready) {
  const { autoStart } = useTour();
  useEffect(() => {
    if (!ready) return undefined;
    // Let the page paint (and animations settle) before measuring targets
    const timer = setTimeout(() => autoStart(id), 600);
    return () => clearTimeout(timer);
  }, [id, ready, autoStart]);
}

function TourOverlay({ tourId, step, position, total, isFirst, isLast, onNext, onBack, onSkip }) {
  const { t } = useTranslation();
  const [rect, setRect] = useState(null);
  const [cardPos, setCardPos] = useState(null);
  const cardRef = useRef(null);

  // Measure the target (after scrolling it into view) and follow scroll / resize
  useLayoutEffect(() => {
    setCardPos(null);
    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      return undefined;
    }
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    let frame;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      });
    };
    measure();
    const settle = setTimeout(measure, 400); // after the smooth scroll
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  // Place the card next to the spotlight, on the side with the most room
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const { width, height } = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setCardPos({ left: (vw - width) / 2, top: Math.max(MARGIN, (vh - height) / 2) });
      return;
    }
    const clampX = (x) => Math.max(MARGIN, Math.min(x, vw - width - MARGIN));
    const clampY = (y) => Math.max(MARGIN, Math.min(y, vh - height - MARGIN));
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - height;
    const centerX = rect.left + rect.width / 2 - width / 2;

    if (step.placement === 'right' && rect.left + rect.width + GAP + width <= vw - MARGIN) {
      setCardPos({ left: rect.left + rect.width + GAP, top: clampY(rect.top) });
    } else if (below + height <= vh - MARGIN) {
      setCardPos({ left: clampX(centerX), top: below });
    } else if (above >= MARGIN) {
      setCardPos({ left: clampX(centerX), top: above });
    } else {
      setCardPos({ left: clampX(centerX), top: clampY(vh - height - MARGIN) });
    }
  }, [rect, step]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onSkip();
      // Enter is handled by the focused primary button
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft' && !isFirst) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onBack, onSkip, isFirst]);

  const key = `tour.${tourId}.${step.id}`;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Dimmed backdrop with a hole around the target; blocks clicks on the page */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="#fff" />
            {rect && <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="12" fill="#000" className="transition-all duration-300" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(10 10 30 / 0.55)" mask="url(#tour-hole)" />
      </svg>
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand shadow-[0_0_0_6px_rgb(97_97_255_/_0.25)] transition-all duration-300"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}

      <div
        ref={cardRef}
        className={clsx(
          'absolute w-[calc(100vw-24px)] max-w-[340px] rounded-2xl border border-line bg-surface p-5 text-ink shadow-pop transition-opacity duration-200',
          cardPos ? 'opacity-100' : 'opacity-0'
        )}
        style={cardPos ?? { left: -9999, top: -9999 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
            {position} / {total}
          </span>
          <button type="button" onClick={onSkip} className="btn-icon -mr-2 -mt-1 h-7 w-7" aria-label={t('tour.skip')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="tour-title" className="text-base font-bold">
          {t(`${key}.title`)}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`${key}.text`)}</p>

        <div className="mt-4 flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={clsx('h-1 flex-1 rounded-full transition-colors', i < position ? 'bg-brand' : 'bg-surface-2')} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {!isLast && (
            <button type="button" onClick={onSkip} className="text-xs font-semibold text-muted transition hover:text-ink">
              {t('tour.skip')}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {!isFirst && (
              <button type="button" onClick={onBack} className="btn-secondary px-3 py-1.5">
                {t('tour.back')}
              </button>
            )}
            <button type="button" onClick={onNext} className="btn-primary px-3.5 py-1.5" autoFocus>
              {isLast ? t('tour.finish') : isFirst && !step.target ? t('tour.start') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
