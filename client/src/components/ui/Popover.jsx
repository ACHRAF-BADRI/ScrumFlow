import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Check } from 'lucide-react';

/**
 * Menu rendered in a portal with fixed positioning, so it is never clipped
 * by scrollable tables or board columns.
 * `trigger` receives ({ open, toggle }) and must spread `ref` via the returned props.
 */
export function Popover({ trigger, children, align = 'start', width, className }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback((e) => {
    e?.stopPropagation();
    setOpen((o) => !o);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 240;
      const menuWidth = menuRef.current?.offsetWidth ?? width ?? 200;
      const below = rect.bottom + 6 + menuHeight <= window.innerHeight;
      let left = align === 'end' ? rect.right - menuWidth : align === 'center' ? rect.left + rect.width / 2 - menuWidth / 2 : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      setPos({ left, top: below ? rect.bottom + 6 : Math.max(8, rect.top - menuHeight - 6), minWidth: Math.max(rect.width, width ?? 0) });
    };
    place();
    // Re-measure once the menu has rendered with its real size
    const frame = requestAnimationFrame(place);
    // A scroll that brought the trigger into view can land just after the click: ignore it
    const openedAt = performance.now();
    const onScroll = (e) => {
      if (performance.now() - openedAt < 250) return;
      if (!menuRef.current?.contains(e.target)) close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, align, width, close]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <>
      {trigger({ open, toggle, ref: triggerRef })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={clsx('menu fixed max-h-[60vh] overflow-y-auto', className)}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: pos?.minWidth, width }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>,
          document.body
        )}
    </>
  );
}

/** A list of options for a Popover. */
export function OptionList({ options, value, onSelect, close }) {
  return (
    <div role="listbox">
      {options.map((opt) => (
        <button
          key={opt.value ?? 'none'}
          type="button"
          role="option"
          aria-selected={opt.value === value}
          className="menu-item"
          onClick={() => {
            onSelect(opt.value);
            close();
          }}
        >
          {opt.render ?? opt.label}
          {opt.value === value && <Check className="ml-auto h-4 w-4 text-brand" />}
        </button>
      ))}
    </div>
  );
}
