import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../context/ProjectsContext';
import { toastError } from '../lib/api';
import { Modal } from './ui/Modal';
import ProjectFields from './ProjectFields';

const EMPTY = { name: '', key: '', description: '', color: '#6161ff' };

export default function NewProjectModal({ open, onClose }) {
  const { t } = useTranslation();
  const { createProject } = useProjects();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setForm(EMPTY);
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const project = await createProject(form);
      toast.success(t('projects.created'));
      close();
      navigate(`/projects/${project._id}`);
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('nav.newProject')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="new-project" className="btn-primary" disabled={saving || !form.name.trim()}>
            {saving ? t('common.saving') : t('projects.create')}
          </button>
        </>
      }
    >
      <form id="new-project" onSubmit={submit}>
        <ProjectFields value={form} onChange={setForm} autoFocus />
      </form>
    </Modal>
  );
}
