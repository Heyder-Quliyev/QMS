import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useChecklistInstances,
  useChecklistTemplates,
  useDeleteChecklist,
  useUpdateChecklistMetadata,
} from '../hooks/useChecklist';
import { ChecklistInstanceStatus } from '../types';
import type {
  ChecklistInstanceStatus as TStatus,
  UpdateChecklistMetadataPayload,
} from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../utils/checklistStatus';
import { CreateChecklistModal } from './CreateChecklistModal';

type StatusFilter = 'all' | TStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: ChecklistInstanceStatus.Draft, label: 'Draft' },
  { value: ChecklistInstanceStatus.InProgress, label: 'In Progress' },
  { value: ChecklistInstanceStatus.PendingApproval, label: 'Pending Approval' },
  { value: ChecklistInstanceStatus.Approved, label: 'Approved' },
  { value: ChecklistInstanceStatus.Voided, label: 'Voided' },
];

export function ChecklistListPage() {
  const navigate = useNavigate();
  const { data: instances, isLoading, error, refetch, isFetching } =
    useChecklistInstances();
  const { data: templates } = useChecklistTemplates();
  const updateMut = useUpdateChecklistMetadata();
  const deleteMut = useDeleteChecklist();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateChecklistMetadataPayload>({
    title: '',
    assignedTo: null,
    dueDate: null,
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const templateItemCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of templates ?? []) {
      map.set(t.name ?? t.title ?? '', t.items?.length ?? 0);
    }
    return map;
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (instances ?? []).filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      const title = row.title?.toLowerCase() ?? '';
      const assigned = row.assignedTo?.toLowerCase() ?? '';
      return title.includes(q) || assigned.includes(q);
    });
  }, [instances, statusFilter, search]);

  const showToast = (kind: 'success' | 'error', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4500);
  };

  const handleCreated = (id: number) => {
    setShowCreate(false);
    navigate(`/${id}`);
  };

  const canEditMetadata = (status: TStatus) =>
    status !== ChecklistInstanceStatus.Approved &&
    status !== ChecklistInstanceStatus.Voided;

  const canDelete = (status: TStatus) =>
    status === ChecklistInstanceStatus.Draft ||
    status === ChecklistInstanceStatus.PendingApproval;

  const startEdit = (row: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(row.id);
    setEditDraft({
      title: row.title ?? '',
      assignedTo: row.assignedTo ?? null,
      dueDate: row.dueDate ?? null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const submitEdit = () => {
    if (editingId == null) return;
    const payload: UpdateChecklistMetadataPayload = {
      title: (editDraft.title ?? '').trim() || 'Untitled Checklist',
      assignedTo: editDraft.assignedTo ? editDraft.assignedTo.trim() || null : null,
      dueDate: editDraft.dueDate,
    };
    updateMut.mutate(
      { instanceId: editingId, payload },
      {
        onSuccess: () => {
          showToast('success', 'Checklist updated.');
          setEditingId(null);
        },
        onError: (e: any) => {
          showToast('error', e?.message ?? 'Failed to update checklist.');
        },
      },
    );
  };

  const confirmDelete = (row: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteConfirmId(row.id);
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const submitDelete = () => {
    if (deleteConfirmId == null) return;
    deleteMut.mutate(deleteConfirmId, {
      onSuccess: () => {
        showToast('success', 'Checklist deleted.');
        setDeleteConfirmId(null);
      },
      onError: (e: any) => {
        showToast('error', e?.message ?? 'Failed to delete checklist.');
        setDeleteConfirmId(null);
      },
    });
  };

  const editingRow =
    editingId != null ? instances?.find((r: any) => r.id === editingId) : null;
  const deleteRow =
    deleteConfirmId != null
      ? instances?.find((r: any) => r.id === deleteConfirmId)
      : null;

  return (
    <div className="checklist-layout checklist-list-layout">
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      <CreateChecklistModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        onError={(text) => showToast('error', text)}
      />

      <div className="list-page-header">
        <div>
          <h1 className="list-page-title">Checklists</h1>
          <p className="list-page-subtitle">
            Browse, filter, and open checklist instances
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowCreate(true)}
        >
          New Checklist
        </button>
      </div>

      <div className="list-toolbar">
        <div className="status-tabs" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={String(tab.value)}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              className={`status-tab${statusFilter === tab.value ? ' active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="list-search"
          placeholder="Search by title or assigned to…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search checklists"
        />
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner" aria-hidden />
          <span>Loading checklists…</span>
        </div>
      ) : error ? (
        <div className="error-state">
          <h2>Unable to load checklists</h2>
          <p>{(error as Error)?.message ?? 'Something went wrong.'}</p>
          <button type="button" className="btn btn-primary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="list-empty-card">
          <p>
            {instances?.length
              ? 'No checklists match your filters.'
              : 'No checklists yet. Create one to get started.'}
          </p>
          {!instances?.length && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              New Checklist
            </button>
          )}
        </div>
      ) : (
        <div className="list-table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Progress</th>
                <th>Created</th>
                <th>Completed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const total = templateItemCounts.get(row.templateTitle);
                const progressLabel =
                  total != null && total > 0
                    ? `${row.progress}/${total} complete`
                    : `${row.progress} complete`;
                const editEnabled = canEditMetadata(row.status);
                const deleteEnabled = canDelete(row.status);

                return (
                  <tr
                    key={row.id}
                    className="list-row-clickable"
                    onClick={() => navigate(`/${row.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/${row.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td className="list-cell-title">{row.title}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.assignedTo ?? '—'}</td>
                    <td>{progressLabel}</td>
                    <td>{formatDate(row.createdAt, true)}</td>
                    <td>{formatDate(row.completedAt, true)}</td>
                    <td
                      className="list-cell-actions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost btn-small row-action-btn"
                        onClick={(e) => startEdit(row, e)}
                        disabled={!editEnabled || updateMut.isPending}
                        title={editEnabled ? 'Edit checklist' : 'Cannot edit Approved/Voided checklists'}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-small row-action-btn"
                        onClick={(e) => confirmDelete(row, e)}
                        disabled={!deleteEnabled || deleteMut.isPending}
                        title={
                          deleteEnabled
                            ? 'Delete checklist'
                            : 'Only Draft or Pending Approval checklists can be deleted'
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {isFetching && !isLoading && (
            <div className="list-refresh-hint">Refreshing…</div>
          )}
        </div>
      )}

      {editingRow != null && editingId != null && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updateMut.isPending) cancelEdit();
          }}
        >
          <div className="modal-card">
            <div className="modal-header">
              <h2>Edit Checklist</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={cancelEdit}
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
                    setEditDraft({ ...editDraft, assignedTo: e.target.value || null })
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
                      dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
                disabled={updateMut.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitEdit}
                disabled={updateMut.isPending || !(editDraft.title ?? '').trim()}
              >
                {updateMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRow != null && deleteConfirmId != null && (
        <div
          className="modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteMut.isPending) cancelDelete();
          }}
        >
          <div className="modal-card">
            <div className="modal-header">
              <h2>Delete Checklist</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={cancelDelete}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{' '}
                <strong>"{deleteRow.title}"</strong>?
              </p>
              <p className="danger-hint">
                This action cannot be undone. All checklist items and audit history will be removed.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelDelete}
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
