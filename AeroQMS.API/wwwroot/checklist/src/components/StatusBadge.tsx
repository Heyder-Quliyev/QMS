import type { ChecklistInstanceStatus as TStatus } from '../types';
import { statusClass, statusLabel } from '../utils/checklistStatus';

interface Props {
  status: TStatus;
}

export function StatusBadge({ status }: Props) {
  return <span className={statusClass(status)}>{statusLabel(status)}</span>;
}
