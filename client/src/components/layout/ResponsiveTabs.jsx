import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useResolvedPath, matchPath } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover } from '../ui/Popover';

const tabClass = (isActive) =>
  clsx(
    'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition',
    isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
  );

function Tab({ tab }) {
  const { t } = useTranslation();
  const Icon = tab.icon;
  return (
    <NavLink to={tab.to} end={tab.end} data-tour={tab.tour} className={({ isActive }) => tabClass(isActive)}>
      <Icon className="h-4 w-4" />
      {t(tab.label)}
    </NavLink>
  );
}

function MenuItem({ tab, close }) {
  const { t } = useTranslation();
  const Icon = tab.icon;
  return (
    <NavLink to={tab.to} end={tab.end} onClick={close} className={({ isActive }) => clsx('menu-item', isActive && 'text-brand')}>
      {({ isActive }) => (
        <>
          <Icon className="h-4 w-4" />
          <span className="flex-1">{t(tab.label)}</span>
          {isActive && <Check className="h-4 w-4" />}
        </>
      )}
    </NavLink>
  );
}

/** Which tab matches the current URL (relative `to`, resolved against the project route). */
function useActiveLabel(tabs, base) {
  const { pathname } = useLocation();
  const baseResolved = useResolvedPath(base);
  return tabs.find((tab) => matchPath({ path: `${baseResolved.pathname}/${tab.to}`.replace(/\/$/, ''), end: tab.end ?? false }, pathname))?.label ?? null;
}

/**
 * Project view tabs. The tabs that don't fit go into a "More" menu; the
 * current tab always stays visible. Widths are measured on a hidden copy.
 */
export default function ResponsiveTabs({ tabs, base = '.' }) {
  const { t } = useTranslation();
  const container = useRef(null);
  const measure = useRef(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const activeLabel = useActiveLabel(tabs, base);

  useLayoutEffect(() => {
    const el = container.current;
    const ruler = measure.current;
    if (!el || !ruler) return undefined;
    const compute = () => {
      const widths = [...ruler.children].map((child) => child.getBoundingClientRect().width + 4); // + gap
      const moreWidth = widths.pop();
      const available = el.clientWidth;
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= available) return setVisibleCount(tabs.length);
      let used = moreWidth;
      let count = 0;
      while (count < widths.length && used + widths[count] <= available) {
        used += widths[count];
        count += 1;
      }
      setVisibleCount(Math.max(1, count));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs, t]);

  // Keep the active tab in view: it replaces the last visible one when it would be hidden
  let visible = tabs.slice(0, visibleCount);
  let hidden = tabs.slice(visibleCount);
  const activeHidden = hidden.find((tab) => tab.label === activeLabel);
  if (activeHidden && visible.length) {
    const swapped = visible[visible.length - 1];
    visible = [...visible.slice(0, -1), activeHidden];
    hidden = [swapped, ...hidden.filter((tab) => tab !== activeHidden)];
  }

  return (
    <div className="relative -mb-px mt-4 overflow-hidden">
      {/* Hidden ruler: every tab + the More button, to know their widths */}
      <div ref={measure} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-1 whitespace-nowrap">
        {tabs.map(({ label, icon: Icon }) => (
          <span key={label} className={tabClass(false)}>
            <Icon className="h-4 w-4" />
            {t(label)}
          </span>
        ))}
        <span className={tabClass(false)}>
          {t('views.more')} <ChevronDown className="h-4 w-4" />
        </span>
      </div>

      <nav ref={container} className="flex gap-1 overflow-hidden" data-tour="view-tabs" aria-label={t('views.label')}>
        {visible.map((tab) => (
          <Tab key={tab.label} tab={tab} />
        ))}
        {hidden.length > 0 && (
          <Popover
            align="end"
            width={220}
            trigger={({ open, toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                className={clsx(tabClass(false), open && 'text-ink')}
                aria-haspopup="menu"
                data-testid="tabs-more"
                data-tour={hidden.find((tab) => tab.tour)?.tour}
              >
                {t('views.more')} <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} />
              </button>
            )}
          >
            {({ close }) => (
              <div role="menu">
                {hidden.map((tab) => (
                  <MenuItem key={tab.label} tab={tab} close={close} />
                ))}
              </div>
            )}
          </Popover>
        )}
      </nav>
    </div>
  );
}
