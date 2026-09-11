import { Link } from 'react-router-dom';
import type { ChecklistInstanceStatus as TStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../utils/checklistStatus';

interface Props {
  title: string;
  status: TStatus;
  assignedTo: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
  readOnly: boolean;
  onComplete: () => void;
  completing: boolean;
  canEditMetadata?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  editing?: boolean;
  deleting?: boolean;
}

export function ChecklistHeader({
  title,
  status,
  assignedTo,
  dueDate,
  createdBy,
  createdAt,
  completedBy,
  completedAt,
  readOnly,
  onComplete,
  completing,
  canEditMetadata = false,
  canDelete = false,
  onEdit,
  onDelete,
  editing = false,
  deleting = false,
}: Props) {
  return (
    <header className="checklist-header">
      <Link to="/list" className="back-to-list">
        ← Back to list
      </Link>
      <div className="checklist-header-top">
        <div>
          <div className="checklist-title-row">
            <h1 className="checklist-title">{title}</h1>
            <StatusBadge status={status} />
          </div>
          <div className="checklist-meta">
            <span title="Created">
              <strong>Created</strong> {formatDate(createdAt)} by {createdBy}
            </span>
            {assignedTo && (
              <span>
                <strong>Assigned to</strong> {assignedTo}
              </span>
            )}
            {dueDate && (
              <span>
                <strong>Due</strong> {formatDate(dueDate)}
              </span>
            )}
            {completedAt && (
              <span>
                <strong>Completed</strong> {formatDate(completedAt)} by{' '}
                {completedBy ?? '—'}
              </span>
            )}
          </div>
        </div>
        <div className="checklist-header-actions">
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onEdit}
              disabled={!canEditMetadata || editing}
              title={canEditMetadata ? 'Edit checklist details' : 'Cannot edit Approved/Voided checklists'}
            >
              {editing ? 'Editing…' : 'Edit'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-small"
            onClick={onDelete}
            disabled={!canDelete || deleting}
            title={
              canDelete
                ? 'Delete checklist'
                : 'Only Draft or Pending Approval checklists can be deleted'
            }
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          {!readOnly && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onComplete}
              disabled={completing}
            >
              {completing ? 'Completing…' : 'Complete Checklist'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
