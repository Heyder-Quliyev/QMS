export type ChecklistInstanceStatus = 0 | 1 | 2 | 3 | 4;
export const ChecklistInstanceStatus = {
  Draft: 0 as ChecklistInstanceStatus,
  InProgress: 1 as ChecklistInstanceStatus,
  Approved: 2 as ChecklistInstanceStatus,
  Voided: 3 as ChecklistInstanceStatus,
  PendingApproval: 4 as ChecklistInstanceStatus,
} as const;

export type ChecklistItemType = 0 | 1 | 2 | 3 | 4;
export const ChecklistItemType = {
  PassFail: 0 as ChecklistItemType,
  YesNo: 1 as ChecklistItemType,
  Text: 2 as ChecklistItemType,
  Number: 3 as ChecklistItemType,
  PhotoRequired: 4 as ChecklistItemType,
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
  textValue: string | null;
  notes: string | null;
  photoPath: string | null;
  completedBy: string | null;
  completedAt: string | null;
  itemType: ChecklistItemType;
  minThreshold: number | null;
  maxThreshold: number | null;
  referenceDocument: string | null;
  isRequired: boolean;
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
  completedAt?: string | null;
  templateTitle: string;
  progress: number; // completed item count (not a percentage)
}

export interface ChecklistTemplateSummary {
  id: number;
  name: string;
  title?: string; // legacy alias from /api/Checklist/templates
  description: string | null;
  category: string | null;
  version: number | null;
  isActive: boolean;
  isAdHoc?: boolean;
  createdBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  itemCount?: number;
  timesUsed?: number;
  items: ChecklistTemplateItemSummary[];
}

export interface ChecklistTemplateItemSummary {
  id: number;
  order: number;
  questionText: string;
  type: string;
  isRequired: boolean;
  regulationReference?: string | null;
}

export interface ChecklistTemplateDetail extends ChecklistTemplateSummary {
  hasSubmissions?: boolean;
}

export interface TemplateItemPayload {
  id?: number;
  order: number;
  questionText: string;
  type: string;
  isRequired: boolean;
  regulationReference?: string | null;
}

export interface CreateTemplatePayload {
  name?: string | null;
  isAdHoc: boolean;
  items: TemplateItemPayload[];
}

export interface UpdateTemplatePayload {
  name?: string | null;
  isAdHoc?: boolean;
  items: TemplateItemPayload[];
}

export interface CreateChecklistPayload {
  templateId: number;
  assignedTo?: string | null;
  dueDate?: string | null;
}

export interface CreatedChecklistInstance {
  id: number;
  title: string;
  status: ChecklistInstanceStatus;
  assignedTo: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
}

export interface UpdateChecklistItemPayload {
  result?: ChecklistItemResult | null;
  numericValue?: number | null;
  textValue?: string | null;
  notes?: string | null;
  photoPath?: string | null;
  validateRequired?: boolean;
}

export interface UpdateChecklistMetadataPayload {
  title: string;
  assignedTo?: string | null;
  dueDate?: string | null;
}
