import { useEffect, useState } from 'react';
import { useChecklistTemplates, useCreateChecklist } from '../hooks/useChecklist';
import { useCreateTemplate } from '../hooks/useTemplates';
import {
  createEmptyQuestion,
  normalizeQuestionOrders,
  validateQuestions,
  type QuestionDraft,
} from '../constants/questionTypes';
import { QuestionListBuilder } from './QuestionListBuilder';
import type { ChecklistTemplateSummary } from '../types';

type ModalTab = 'template' | 'custom';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
  onError: (message: string) => void;
}

function templateLabel(t: ChecklistTemplateSummary) {
  return t.name ?? t.title ?? 'Untitled';
}

export function CreateChecklistModal({ open, onClose, onCreated, onError }: Props) {
  const { data: templates, isLoading: templatesLoading } = useChecklistTemplates();
  const createMut = useCreateChecklist();
  const createTemplateMut = useCreateTemplate();

  const [tab, setTab] = useState<ModalTab>('template');
  const [templateId, setTemplateId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([createEmptyQuestion()]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const busy = createMut.isPending || createTemplateMut.isPending;

  useEffect(() => {
    if (!open) return;
    setTab('template');
    setTemplateId('');
    setAssignedTo('');
    setDueDate('');
    setCustomTitle('');
    setQuestions([createEmptyQuestion()]);
    setSaveAsTemplate(false);
    setTemplateName('');
  }, [open]);

  const createInstance = (newTemplateId: number) => {
    createMut.mutate(
      {
        templateId: newTemplateId,
        assignedTo: assignedTo.trim() || null,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
      },
      {
        onSuccess: (data) => onCreated(data.id),
        onError: (err: Error) => onError(err?.message ?? 'Failed to create checklist.'),
      },
    );
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTemplateId = Number(templateId);
    if (!templateId || !Number.isInteger(parsedTemplateId) || parsedTemplateId <= 0) {
      onError('Please select a checklist template.');
      return;
    }
    createInstance(parsedTemplateId);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const questionError = validateQuestions(questions);
    if (questionError) {
      onError(questionError);
      return;
    }
    if (saveAsTemplate && !templateName.trim()) {
      onError('Template name is required when saving as a reusable template.');
      return;
    }

    const filled = normalizeQuestionOrders(
      questions.filter((q) => q.questionText.trim()),
    );

    const isAdHoc = !saveAsTemplate;
    const name = saveAsTemplate
      ? templateName.trim()
      : customTitle.trim() || undefined;

    createTemplateMut.mutate(
      {
        name,
        isAdHoc,
        items: filled.map((q) => ({
          order: q.order,
          questionText: q.questionText.trim(),
          type: q.type,
          isRequired: q.isRequired,
          regulationReference: q.regulationReference.trim() || null,
        })),
      },
      {
        onSuccess: (data) => createInstance(data.templateId),
        onError: (err: Error) =>
          onError(err?.message ?? 'Failed to create custom checklist template.'),
      },
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !busy) onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-checklist-title"
      >
        <div className="modal-header">
          <h2 id="create-checklist-title" className="modal-title">
            New Checklist
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-tabs" role="tablist" aria-label="Create checklist mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'template'}
            className={`modal-tab${tab === 'template' ? ' active' : ''}`}
            onClick={() => setTab('template')}
            disabled={busy}
          >
            Use Template
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'custom'}
            className={`modal-tab${tab === 'custom' ? ' active' : ''}`}
            onClick={() => setTab('custom')}
            disabled={busy}
          >
            Create Custom Checklist
          </button>
        </div>

        {tab === 'template' ? (
          <form className="modal-form" onSubmit={handleTemplateSubmit}>
            <div className="form-field">
              <label className="field-label" htmlFor="template-select">
                Template
              </label>
              <select
                id="template-select"
                className="form-select"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={templatesLoading || busy}
                required
              >
                <option value="">
                  {templatesLoading ? 'Loading templates…' : 'Select a template…'}
                </option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {templateLabel(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="assigned-to-template">
                Assigned To
              </label>
              <input
                id="assigned-to-template"
                type="text"
                className="form-input"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Name or user ID"
                disabled={busy}
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="due-date-template">
                Due Date
              </label>
              <input
                id="due-date-template"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || templatesLoading}
              >
                {busy ? 'Creating…' : 'Create Checklist'}
              </button>
            </div>
          </form>
        ) : (
          <form className="modal-form" onSubmit={handleCustomSubmit}>
            <div className="form-field">
              <label className="field-label" htmlFor="custom-title">
                Checklist Title
              </label>
              <input
                id="custom-title"
                type="text"
                className="form-input"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Optional — auto-named if blank"
                disabled={busy}
              />
            </div>

            <QuestionListBuilder items={questions} onChange={setQuestions} disabled={busy} />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                disabled={busy}
              />
              <span>Save this as a reusable template</span>
            </label>

            {saveAsTemplate && (
              <div className="form-field">
                <label className="field-label" htmlFor="template-name">
                  Template Name
                </label>
                <input
                  id="template-name"
                  type="text"
                  className="form-input"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Required when saving as template"
                  disabled={busy}
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label className="field-label" htmlFor="assigned-to-custom">
                Assigned To
              </label>
              <input
                id="assigned-to-custom"
                type="text"
                className="form-input"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Name or user ID"
                disabled={busy}
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="due-date-custom">
                Due Date
              </label>
              <input
                id="due-date-custom"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Creating…' : 'Create Checklist'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
