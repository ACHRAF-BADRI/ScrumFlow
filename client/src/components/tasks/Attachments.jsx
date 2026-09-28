import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useProject } from '../../context/ProjectContext';
import { errorMessage } from '../../lib/api';
import { formatSize, thumbnail } from '../../lib/upload';
import { useServerConfig } from '../../lib/serverConfig';
import { relativeTime } from '../../lib/format';
import { useConfirm } from '../ui/Confirm';
import Tooltip from '../ui/Tooltip';

export function uploadErrorMessage(err, t) {
  return err?.code?.startsWith?.('errors.') && !err.response ? t(err.code) : errorMessage(err);
}

/** Files of a task: images as thumbnails, other files as a list. Drop files on the section to upload. */
export default function Attachments({ task }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { attachments: enabled } = useServerConfig();
  const { canManage, uploadAttachment, deleteAttachment } = useProject();
  const [uploads, setUploads] = useState([]); // [{ id, name, progress }]
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const files = task.attachments ?? [];
  if (!enabled && !files.length) return null;

  const upload = async (list) => {
    for (const file of [...list]) {
      const id = Math.random().toString(36).slice(2);
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        await uploadAttachment(task._id, file, (progress) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))));
      } catch (err) {
        toast.error(uploadErrorMessage(err, t));
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
  };

  const remove = async (file) => {
    const ok = await confirm({ title: t('files.delete'), message: t('files.deleteConfirm', { name: file.name }), danger: true, confirmLabel: t('common.delete') });
    if (ok) deleteAttachment(task._id, file._id);
  };

  const images = files.filter((f) => f.resourceType === 'image');
  const others = files.filter((f) => f.resourceType !== 'image');
  const canDelete = (file) => canManage || (file.uploadedBy?._id ?? file.uploadedBy) === user._id;

  return (
    <section
      className={clsx('rounded-xl transition', dragging && 'bg-brand/5 ring-2 ring-dashed ring-brand/50')}
      onDragOver={(e) => {
        if (!enabled || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!enabled || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        upload(e.dataTransfer.files);
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="label mb-0 flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> {t('files.title')} {files.length > 0 && <span>({files.length})</span>}
        </h3>
        {enabled && (
          <>
            <button type="button" className="btn-ghost h-7 px-2 text-xs" onClick={() => input.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {t('files.upload')}
            </button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              data-testid="file-input"
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {files.length === 0 && uploads.length === 0 && <p className="text-xs text-muted">{t('files.empty')}</p>}

      {images.length > 0 && (
        <ul className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((file) => (
            <li key={file._id} className="group relative overflow-hidden rounded-lg border border-line">
              <a href={file.url} target="_blank" rel="noopener noreferrer" title={file.name}>
                <img src={thumbnail(file.url)} alt={file.name} loading="lazy" className="aspect-[16/10] w-full bg-surface-2 object-cover" />
              </a>
              {canDelete(file) && (
                <button
                  type="button"
                  onClick={() => remove(file)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white opacity-0 transition hover:bg-[#e2445c] group-hover:opacity-100"
                  aria-label={t('files.delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {(others.length > 0 || uploads.length > 0) && (
        <ul className="space-y-1.5">
          {others.map((file) => (
            <li key={file._id} className="group flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
              <FileText className="h-5 w-5 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-brand">
                  {file.name}
                </a>
                <p className="text-[11px] text-muted">
                  {[formatSize(file.size), file.uploadedBy?.name, relativeTime(file.createdAt)].filter(Boolean).join(', ')}
                </p>
              </div>
              <Tooltip label={t('files.download')}>
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn-icon h-7 w-7" aria-label={t('files.download')}>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Tooltip>
              {canDelete(file) && (
                <button type="button" className="btn-icon h-7 w-7 hover:text-[#e2445c]" onClick={() => remove(file)} aria-label={t('files.delete')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {uploads.map((u) => (
            <li key={u.id} className="rounded-lg border border-dashed border-line px-2.5 py-2">
              <p className="truncate text-sm text-muted">{t('files.uploading', { name: u.name })}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {enabled && <p className="mt-1.5 text-[11px] text-muted">{t('files.hint')}</p>}
    </section>
  );
}
