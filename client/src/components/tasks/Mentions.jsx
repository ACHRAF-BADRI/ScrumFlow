import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "@" + the word being typed, right before the caret
const TRIGGER = /(^|\s)@([\p{L}\p{N}]*)$/u;

/**
 * Textarea with @mention suggestions. Picking a member inserts "@Full Name",
 * which the API recognizes to email that person.
 */
export const MentionTextarea = forwardRef(function MentionTextarea({ value, onChange, members, onSubmitShortcut, ...props }, ref) {
  const [query, setQuery] = useState(null); // null = closed
  const [active, setActive] = useState(0);
  const innerRef = useRef(null);
  const pendingCaret = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  // Place the caret right after the inserted mention, before any further typing
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !innerRef.current) return;
    innerRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)) || m.name.toLowerCase().startsWith(q)).slice(0, 5);
  }, [members, query]);

  const detect = (el) => {
    const match = el.value.slice(0, el.selectionStart).match(TRIGGER);
    setQuery(match ? match[2] : null);
    setActive(0);
  };

  const pick = (member, el) => {
    const caret = el.selectionStart;
    const before = el.value.slice(0, caret).replace(TRIGGER, (_, space) => `${space}@${member.name} `);
    pendingCaret.current = before.length;
    onChange(before + el.value.slice(caret));
    setQuery(null);
    el.focus();
  };

  return (
    <div className="relative">
      <textarea
        ref={innerRef}
        {...props}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target);
        }}
        onClick={(e) => detect(e.target)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (suggestions.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              pick(suggestions[active], e.currentTarget);
              return;
            }
            if (e.key === 'Escape') {
              e.stopPropagation(); // keep the task panel open
              setQuery(null);
              return;
            }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmitShortcut?.(e);
        }}
      />
      {suggestions.length > 0 && (
        <ul role="listbox" className="menu absolute left-2 top-full z-20 mt-1 w-64">
          {suggestions.map((m, i) => (
            <li key={m._id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => pick(m, e.currentTarget.closest('.relative').querySelector('textarea'))}
                className={clsx('menu-item', i === active && 'bg-surface-2')}
              >
                <Avatar user={m} size="sm" />
                <span className="truncate">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

/** Comment text with "@Full Name" / "@FirstName" of members highlighted. */
export function CommentText({ text, members }) {
  const parts = useMemo(() => {
    const names = members.flatMap((m) => [m.name, m.name.split(/\s+/)[0]]).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!names.length || !text.includes('@')) return [text];
    const re = new RegExp(`(@(?:${[...new Set(names)].map(escapeRegExp).join('|')}))(?![\\p{L}\\p{N}])`, 'giu');
    return text.split(re);
  }, [text, members]);

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="rounded bg-brand/10 px-1 font-semibold text-brand">
        {part}
      </span>
    ) : (
      part
    )
  );
}
