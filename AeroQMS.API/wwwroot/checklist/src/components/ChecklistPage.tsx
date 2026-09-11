import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  useChecklistInstance,
  useCompleteChecklist,
  useDeleteChecklist,
  useUpdateChecklistItem,
  useUpdateChecklistMetadata,
  useUploadChecklistPhoto,
} from '../hooks/useChecklist';
import { ChecklistHeader } from './ChecklistHeader';
import { ProgressBar } from './ProgressBar';
import { ChecklistItemRow } from './ChecklistItemRow';
import { ChecklistInstanceStatus, ChecklistItemType } from '../types';
import type {
  ChecklistItem,
  ChecklistItemResult as TResult,
  UpdateChecklistMetadataPayload,
} from '../types';

function readInstanceId(): number | null {
  const params = useParams();
  const raw = params.instanceId;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isItemComplete(item: ChecklistItem) {
  switch (item.itemType) {
    case ChecklistItemType.Text:
      return !!item.textValue?.trim();
    case ChecklistItemType.Number:
      return item.numericValue != null || item.result != null;
    case ChecklistItemType.PhotoRequired:
      return !!item.photoPath?.trim();
    default:
      return item.result != null;
  }
}

export function ChecklistPage() {
  const navigate = useNavigate();
  const instanceId = readInstanceId();
  const { data, isFetching, isLoading, error } = useChecklistInstance(instanceId);
  const updateMut = useUpdateChecklistItem();
  const uploadMut = useUploadChecklistPhoto();
  const completeMut = useCompleteChecklist();
  const metaMut = useUpdateChecklistMetadata();
  const deleteMut = useDeleteChecklist();
  const [toast, setToast] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<UpdateChecklistMetadataPayload>({
    title: '',
    assignedTo: null,
    dueDate: null,
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const canEditMetadata = useMemo(() => {
    if (!data) return false;
    return (
      data.status !== ChecklistInstanceStatus.Approved &&
      data.status !== ChecklistInstanceStatus.Voided
    );
  }, [data]);

  const canDelete = useMemo(() => {
    if (!data) return false;
    return (
      data.status === ChecklistInstanceStatus.Draft ||
      data.status === ChecklistInstanceStatus.PendingApproval
    );
  }, [data]);

  const isReadOnly = useMemo(() => {
    if (!data) return false;
    return (
      data.status === ChecklistInstanceStatus.PendingApproval ||
      data.status === ChecklistInstanceStatus.Approved ||
      data.status === ChecklistInstanceStatus.Voided
    );
  }, [data]);

  const total = data?.items?.length ?? 0;
  const complete = data?.items?.filter(isItemComplete).length ?? 0;

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), kind === 'success' ? 3500 : 4500);
  };

  const onItemChange = (
    item: ChecklistItem,
    payload: {
      result?: TResult | null;
      numericValue?: number | null;
      textValue?: string | null;
      notes?: string | null;
      photoPath?: string | null;
      validateRequired?: boolean;
    },
  ) => {
    if (instanceId == null) return;

    updateMut.mutate(
      { instanceId, itemId: item.id, payload },
      {
        onError: (e: any) => {
          showToast(
            'error',
            e?.message ?? 'Failed to save checklist item. Changes reverted.',
          );
        },
      },
    );
  };

  const onUploadPhoto = (item: ChecklistItem, file: File) => {
    if (instanceId == null) return;

    uploadMut.mutate(
      { instanceId, itemId: item.id, file },
      {
        onSuccess: ({ path }) => {
          onItemChange(item, {
            result: item.result,
            numericValue: item.numericValue,
            textValue: item.textValue,
            notes: item.notes,
            photoPath: path,
            validateRequired: true,
          });
        },
        onError: (e: any) => {
          showToast('error', e?.message ?? 'Photo upload failed.');
        },
      },
    );
  };

  const onComplete = () => {
    if (!data) return;
    completeMut.mutate(data.id, {
      onSuccess: (response: any) => {
        showToast(
          'success',
          response?.message ?? 'Checklist submitted for approval.',
        );
      },
      onError: (e: any) => {
        showToast(
          'error',
          e?.message ?? 'Could not submit checklist for approval.',
        );
      },
    });
  };

  const openEdit = () => {
    if (!data) return;
    setEditDraft({
      title: data.title ?? '',
      assignedTo: data.assignedTo ?? null,
      dueDate: data.dueDate ?? null,
    });
    setEditOpen(true);
  };

  const submitEdit = () => {
    if (!data) return;
    const payload: UpdateChecklistMetadataPayload = {
      title: (editDraft.title ?? '').trim() || 'Untitled Checklist',
      assignedTo: editDraft.assignedTo
        ? editDraft.assignedTo.trim() || null
        : null,
      dueDate: editDraft.dueDate,
    };
    metaMut.mutate(
      { instanceId: data.id, payload },
      {
        onSuccess: () => {
          showToast('success', 'Checklist updated.');
          setEditOpen(false);
        },
        onError: (e: any) => {
          showToast('error', e?.message ?? 'Failed to update checklist.');
        },
      },
    );
  };

  const openDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
  };

  const submitDelete = () => {
    if (!data) return;
    deleteMut.mutate(data.id, {
      onSuccess: () => {
        showToast('success', 'Checklist deleted.');
        setDeleteConfirmOpen(false);
        navigate('/list');
      },
      onError: (e: any) => {
        showToast('error', e?.message ?? 'Failed to delete checklist.');
        setDeleteConfirmOpen(false);
      },
    });
  };

  if (!instanceId) {
    return (
      <div className="checklist-layout">
        <div className="checklist-empty">
          <h2>No checklist selected</h2>
          <p>Open a checklist from the list or create a new one.</p>
          <Link className="btn btn-primary" to="/list">
            View all checklists
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="checklist-layout">
        <div className="loading-state">
          <div className="spinner" aria-hidden />
          <span>Loading checklist…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="checklist-layout">
        <div className="error-state">
          <h2>Unable to load checklist</h2>
          <p>{(error as any)?.message ?? 'The checklist could not be found.'}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checklist-layout">
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      <ChecklistHeader
        title={data.title}
        status={data.status}
        assignedTo={data.assignedTo}
        dueDate={data.dueDate}
        createdBy={data.createdBy}
        createdAt={data.createdAt}
        completedBy={data.completedBy}
        completedAt={data.completedAt}
        readOnly={isReadOnly}
        onComplete={onComplete}
        completing={completeMut.isPending}
        canEditMetadata={canEditMetadata}
        canDelete={canDelete}
        onEdit={openEdit}
        onDelete={openDeleteConfirm}
        editing={metaMut.isPending}
        deleting={deleteMut.isPending}
      />

      <ProgressBar complete={complete} total={total} />

      <div className="items-list">
        {(data.items ?? []).map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            readOnly={isReadOnly}
            changing={updateMut.isPending}
            uploadingPhoto={uploadMut.isPending}
            onChange={(payload) => onItemChange(item, payload)}
            onUploadPhoto={(file) => onUploadPhoto(item, file)}
          />
        ))}
      </div>

      {editOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Edit Checklist</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setEditOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="field-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editDraft.title ?? ''}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, title: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <label className="field-label">Assigned To</label>
                <input
                  type="text"
                  className="form-input"
                  value={editDraft.assignedTo ?? ''}
                  placeholder="Optional"
                  onChange={(e) =>
                    setEditDraft({
                      ...editDraft,
                      assignedTo: e.target.value || null,
                    })
                  }
                />
              </div>
              <div className="form-row">
                <label className="field-label">Due Date</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={
                    editDraft.dueDate
                      ? new Date(editDraft.dueDate).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    setEditDraft({
                      ...editDraft,
                      dueDate: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditOpen(false)}
                disabled={metaMut.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitEdit}
                disabled={metaMut.isPending || !(editDraft.title ?? '').trim()}
              >
                {metaMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Delete Checklist</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{' '}
                <strong>"{data?.title ?? 'this checklist'}"</strong>?
              </p>
              <p className="danger-hint">
                This action cannot be undone. All checklist items and audit history will be removed.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleteMut.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={submitDelete}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
