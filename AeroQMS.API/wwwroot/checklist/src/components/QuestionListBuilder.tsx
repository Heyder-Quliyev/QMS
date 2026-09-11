import type { QuestionDraft, QuestionType } from '../constants/questionTypes';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  createEmptyQuestion,
  normalizeQuestionOrders,
} from '../constants/questionTypes';

interface Props {
  items: QuestionDraft[];
  onChange: (items: QuestionDraft[]) => void;
  disabled?: boolean;
  showRegulationReference?: boolean;
}

export function QuestionListBuilder({
  items,
  onChange,
  disabled = false,
  showRegulationReference = true,
}: Props) {
  const updateItem = (clientId: string, patch: Partial<QuestionDraft>) => {
    onChange(
      items.map((item) =>
        item.clientId === clientId ? { ...item, ...patch } : item,
      ),
    );
  };

  const removeItem = (clientId: string) => {
    if (items.length <= 1) return;
    onChange(normalizeQuestionOrders(items.filter((i) => i.clientId !== clientId)));
  };

  const addItem = () => {
    onChange(normalizeQuestionOrders([...items, createEmptyQuestion(items.length + 1)]));
  };

  return (
    <div className="question-builder">
      <div className="question-builder-header">
        <span>Question</span>
        <span>Type</span>
        <span>Required</span>
        <span aria-hidden />
      </div>

      {items.map((item) => {
        const isLocked = !!item.locked;
        const rowDisabled = disabled || isLocked;

        return (
          <div
            key={item.clientId}
            className={`question-row${isLocked ? ' question-row-locked' : ''}`}
          >
            <input
              type="text"
              className="form-input"
              value={item.questionText}
              placeholder="Enter question text…"
              disabled={rowDisabled}
              onChange={(e) => updateItem(item.clientId, { questionText: e.target.value })}
            />
            <select
              className="form-select"
              value={item.type}
              disabled={rowDisabled}
              onChange={(e) =>
                updateItem(item.clientId, { type: e.target.value as QuestionType })
              }
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <label className="question-required">
              <input
                type="checkbox"
                checked={item.isRequired}
                disabled={rowDisabled}
                onChange={(e) =>
                  updateItem(item.clientId, { isRequired: e.target.checked })
                }
              />
              <span>Required</span>
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-small question-remove"
              onClick={() => removeItem(item.clientId)}
              disabled={rowDisabled || items.length <= 1}
              aria-label="Remove question"
            >
              Remove
            </button>
            {showRegulationReference && (
              <input
                type="text"
                className="form-input question-regulation"
                value={item.regulationReference}
                placeholder="Regulation reference (optional)"
                disabled={rowDisabled}
                onChange={(e) =>
                  updateItem(item.clientId, { regulationReference: e.target.value })
                }
              />
            )}
            {isLocked && (
              <div className="question-locked-note">
                Used in submissions — cannot edit or remove
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="btn btn-ghost question-add"
        onClick={addItem}
        disabled={disabled}
      >
        + Add Question
      </button>
    </div>
  );
}

export function questionsFromApiItems(
  apiItems: Array<{
    id: number;
    order: number;
    questionText: string;
    type: string;
    isRequired: boolean;
    regulationReference?: string | null;
  }>,
  locked = false,
): QuestionDraft[] {
  return apiItems.map((item) => ({
    clientId: `existing-${item.id}`,
    id: item.id,
    order: item.order,
    questionText: item.questionText,
    type: (QUESTION_TYPES.includes(item.type as QuestionType)
      ? item.type
      : 'PassFail') as QuestionType,
    isRequired: item.isRequired,
    regulationReference: item.regulationReference ?? '',
    locked,
  }));
}
