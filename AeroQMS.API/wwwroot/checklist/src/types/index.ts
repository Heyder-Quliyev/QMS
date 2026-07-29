export type ChecklistInstanceStatus = 0 | 1 | 2 | 3; // Draft, InProgress, Completed, Voided
export const ChecklistInstanceStatus = {
  Draft: 0 as ChecklistInstanceStatus,
  InProgress: 1 as ChecklistInstanceStatus,
  Completed: 2 as ChecklistInstanceStatus,
  Voided: 3 as ChecklistInstanceStatus,
} as const;

export type ChecklistItemType = 0 | 1; // Text, Numeric
export const ChecklistItemType = {
  Text: 0 as ChecklistItemType,
  Numeric: 1 as ChecklistItemType,
} as const;

export type ChecklistItemResult = 0 | 1 | 2; // Pass, Fail, NA
export const ChecklistItemResult = {
  Pass: 0 as ChecklistItemResult,
  Fail: 1 as ChecklistItemResult,
  NA: 2 as ChecklistItemResult,
} as const;

export interface ChecklistItem {
  id: number;
  checklistTemplateItemId: number;
  text: string;
  orderIndex: number;
  result: ChecklistItemResult | null; // null = not yet marked
  numericValue: number | null;
  notes: string | null;
  photoPath: string | null;
  completedBy: string | null;
  completedAt: string | null;
  itemType: ChecklistItemType;
  minThreshold: number | null;
  maxThreshold: number | null;
  referenceDocument: string | null;
  requiresNoteOnFail: boolean;
  requiresPhotoOnFail: boolean;
  allowNA: boolean;
}

export interface ChecklistInstanceDetail {
  id: number;
  title: string;
  status: ChecklistInstanceStatus;
  assignedTo: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
  items: ChecklistItem[];
}

export interface ChecklistInstanceSummary {
  id: number;
  title: string;
  status: ChecklistInstanceStatus;
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
  templateTitle: string;
  progress: number; // completed item count (not a percentage)
}

export interface UpdateChecklistItemPayload {
  result?: ChecklistItemResult | null;
  numericValue?: number | null;
  notes?: string | null;
  photoPath?: string | null;
}
