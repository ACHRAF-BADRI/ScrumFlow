import { cloneElement, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const MARGIN = 8;

/**
 * Themed hover/focus tooltip rendered in a portal, so it is never clipped by
 * scrolling containers. Use it instead of the native `title` attribute, whose
 * bubble is drawn by the OS and ignores dark mode.
 * side: "top" | "bottom" | "right". `disabled` renders the child as-is.
 */
export default function Tooltip({ label, side = 'top', disabled, children }) {
  const [anchor, setAnchor] = useState(null);
  const [style, setStyle] = useState(null);
  const tipRef = useRef(null);

  // Place the bubble once it has a size, keeping it inside the viewport
  useLayoutEffect(() => {
    if (!anchor || !tipRef.current) return;
    const { width, height } = tipRef.current.getBoundingClientRect();
    let left;
    let top;
    if (side === 'right') {
      left = anchor.right + GAP;
      top = anchor.top + anchor.height / 2 - height / 2;
    } else {
      left = anchor.left + anchor.width / 2 - width / 2;
      const above = anchor.top - GAP - height;
      const below = anchor.bottom + GAP;
      top = side === 'top' ? (above >= MARGIN ? above : below) : below + height > window.innerHeight ? above : below;
    }
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
    setStyle({ left, top });
  }, [anchor, side, label]);

  if (disabled || !label) return children;

  const show = (e) => setAnchor(e.currentTarget.getBoundingClientRect());
  const hide = () => {
    setAnchor(null);
    setStyle(null);
  };

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
        onPointerDown: (e) => {
          hide();
          children.props.onPointerDown?.(e);
        },
        'aria-label': children.props['aria-label'] ?? (typeof label === 'string' ? label : undefined),
      })}
      {anchor &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="pointer-events-none fixed z-[70] max-w-xs animate-fade-in rounded-lg border border-white/10 bg-[#1f2030] px-2.5 py-1.5 text-xs font-semibold text-white shadow-pop dark:border-line dark:bg-[#3a3c58]"
            style={style ?? { left: -9999, top: -9999 }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}
