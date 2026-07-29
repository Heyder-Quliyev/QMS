import type { ChecklistInstanceStatus as TStatus } from '../types';
import { ChecklistInstanceStatus } from '../types';

function statusLabel(status: TStatus) {
  switch (status) {
    case ChecklistInstanceStatus.Draft:
      return 'Draft';
    case ChecklistInstanceStatus.InProgress:
      return 'In Progress';
    case ChecklistInstanceStatus.Completed:
      return 'Completed';
    case ChecklistInstanceStatus.Voided:
      return 'Voided';
    default:
      return 'Unknown';
  }
}

function statusClass(status: TStatus) {
  switch (status) {
    case ChecklistInstanceStatus.Draft:
      return 'badge badge-draft';
    case ChecklistInstanceStatus.InProgress:
      return 'badge badge-progress';
    case ChecklistInstanceStatus.Completed:
      return 'badge badge-success';
    case ChecklistInstanceStatus.Voided:
      return 'badge badge-muted';
    default:
      return 'badge';
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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
}: Props) {
  return (
    <header className="checklist-header">
      <div className="checklist-header-top">
        <div>
          <div className="checklist-title-row">
            <h1 className="checklist-title">{title}</h1>
            <span className={statusClass(status)}>{statusLabel(status)}</span>
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
        {!readOnly && (
          <div className="checklist-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onComplete}
              disabled={completing}
            >
              {completing ? 'Completing…' : 'Complete Checklist'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
