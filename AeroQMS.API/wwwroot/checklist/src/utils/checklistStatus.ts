import type { ChecklistInstanceStatus as TStatus } from '../types';
import { ChecklistInstanceStatus } from '../types';

export function statusLabel(status: TStatus) {
  switch (status) {
    case ChecklistInstanceStatus.Draft:
      return 'Draft';
    case ChecklistInstanceStatus.InProgress:
      return 'In Progress';
    case ChecklistInstanceStatus.Approved:
      return 'Approved';
    case ChecklistInstanceStatus.Voided:
      return 'Voided';
    case ChecklistInstanceStatus.PendingApproval:
      return 'Pending Approval';
    default:
      return 'Unknown';
  }
}

export function statusClass(status: TStatus) {
  switch (status) {
    case ChecklistInstanceStatus.Draft:
      return 'badge badge-draft';
    case ChecklistInstanceStatus.InProgress:
      return 'badge badge-progress';
    case ChecklistInstanceStatus.Approved:
      return 'badge badge-success';
    case ChecklistInstanceStatus.Voided:
      return 'badge badge-muted';
    case ChecklistInstanceStatus.PendingApproval:
      return 'badge badge-warning';
    default:
      return 'badge';
  }
}

export function formatDate(iso: string | null | undefined, dateOnly = false) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (dateOnly) {
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    }
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
