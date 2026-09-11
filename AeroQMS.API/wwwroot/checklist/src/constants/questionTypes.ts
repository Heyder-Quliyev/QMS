/** Keep in sync with AeroQMS.API.Models.ChecklistQuestionTypes */
export const QUESTION_TYPES = [
  'PassFail',
  'YesNo',
  'Text',
  'Number',
  'PhotoRequired',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  PassFail: 'Pass / Fail',
  YesNo: 'Yes / No',
  Text: 'Text',
  Number: 'Number',
  PhotoRequired: 'Photo Required',
};

export function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value);
}

export function defaultQuestionType(): QuestionType {
  return 'PassFail';
}

export interface QuestionDraft {
  clientId: string;
  id?: number;
  order: number;
  questionText: string;
  type: QuestionType;
  isRequired: boolean;
  regulationReference: string;
  locked?: boolean;
}

export function createEmptyQuestion(order = 1): QuestionDraft {
  return {
    clientId: crypto.randomUUID(),
    order,
    questionText: '',
    type: defaultQuestionType(),
    isRequired: true,
    regulationReference: '',
  };
}

export function normalizeQuestionOrders(items: QuestionDraft[]): QuestionDraft[] {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

export function validateQuestions(items: QuestionDraft[]): string | null {
  const filled = items.filter((i) => i.questionText.trim());
  if (filled.length === 0) return 'Add at least one question.';
  if (filled.some((i) => !i.questionText.trim())) {
    return 'Each question must have text.';
  }
  return null;
}
