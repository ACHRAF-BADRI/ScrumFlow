import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Bold, Code, Italic, Link2, List, ListChecks, ListOrdered } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tooltip from './Tooltip';

marked.setOptions({ gfm: true, breaks: true });

// Links open in a new tab, without giving the other page access to ours
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Markdown to safe HTML; "@Full Name" of members is highlighted. */
export function renderMarkdown(text, members = []) {
  let source = String(text ?? '');
  const names = [...new Set(members.flatMap((m) => [m.name, m.name?.split(/\s+/)[0]]).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (names.length && source.includes('@')) {
    const re = new RegExp(`@(${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
    source = source.replace(re, (_, name) => `<span class="mention">@${escapeHtml(name)}</span>`);
  }
  // Checkboxes of task lists are kept (marked renders them disabled), forms are not
  return DOMPurify.sanitize(marked.parse(source), { FORBID_ATTR: ['style'], FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'] });
}

export function Markdown({ text, members, className }) {
  const html = useMemo(() => renderMarkdown(text, members), [text, members]);
  return <div className={clsx('md', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Toolbar: [icon, i18n key, before, after, line prefix]
const TOOLS = [
  [Bold, 'md.bold', '**', '**'],
  [Italic, 'md.italic', '_', '_'],
  [Code, 'md.code', '`', '`'],
  [Link2, 'md.link', '[', '](https://)'],
  [List, 'md.bullets', '', '', '- '],
  [ListOrdered, 'md.numbers', '', '', '1. '],
  [ListChecks, 'md.tasks', '', '', '- [ ] '],
];

/**
 * Markdown textarea with a Write / Preview switch and a small toolbar.
 * `onPasteFile(file)` (optional) uploads a pasted or dropped image and
 * resolves to its URL, which is inserted as an image.
 */
export function MarkdownEditor({ value, onChange, onPasteFile, placeholder, minHeight = 140, autoFocus, id, members, onKeyDown }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('write');
  const ref = useRef(null);

  const apply = ([, , before, after, prefix]) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    let next;
    let caret;
    if (prefix) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      caret = end + prefix.length;
    } else {
      const selected = value.slice(start, end);
      next = value.slice(0, start) + before + selected + after + value.slice(end);
      caret = start + before.length + selected.length;
    }
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const insertFiles = async (files, el) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length || !onPasteFile) return false;
    for (const file of images) {
      const marker = `![${t('md.uploading')}](${Math.random().toString(36).slice(2)})`;
      const at = el.selectionStart;
      onChange((current) => current.slice(0, at) + marker + current.slice(at));
      const url = await onPasteFile(file);
      onChange((current) => current.replace(marker, url ? `![${file.name || 'image'}](${url})` : ''));
    }
    return true;
  };

  return (
    <div className="rounded-lg border border-line bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-1.5 py-1">
        {['write', 'preview'].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={clsx('rounded-md px-2.5 py-1 text-xs font-semibold transition', tab === name ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink')}
          >
            {t(`md.${name}`)}
          </button>
        ))}
        {tab === 'write' && (
          <div className="ml-auto flex">
            {TOOLS.map((tool) => {
              const Icon = tool[0];
              return (
                <Tooltip key={tool[1]} label={t(tool[1])}>
                  <button type="button" className="btn-icon h-7 w-7" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(tool)} aria-label={t(tool[1])}>
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ref}
          id={id}
          autoFocus={autoFocus}
          className="block w-full resize-y rounded-b-lg bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted/60"
          style={{ minHeight }}
          placeholder={placeholder}
          value={value}
          maxLength={5000}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={async (e) => {
            if (e.clipboardData.files.length && onPasteFile) {
              e.preventDefault();
              await insertFiles(e.clipboardData.files, e.currentTarget);
            }
          }}
          onDrop={async (e) => {
            if (e.dataTransfer.files.length && onPasteFile) {
              e.preventDefault();
              await insertFiles(e.dataTransfer.files, e.currentTarget);
            }
          }}
        />
      ) : (
        <div className="px-3 py-2.5" style={{ minHeight }}>
          {value.trim() ? <Markdown text={value} members={members} /> : <p className="text-sm text-muted">{t('md.nothing')}</p>}
        </div>
      )}
      <p className="border-t border-line px-3 py-1 text-[11px] text-muted">{onPasteFile ? t('md.hintImages') : t('md.hint')}</p>
    </div>
  );
}
