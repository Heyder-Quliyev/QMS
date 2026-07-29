import { useMemo, useState } from 'react';
import type { ChecklistItem, ChecklistItemResult as TResult } from '../types';
import {
  ChecklistItemResult,
  ChecklistItemType,
} from '../types';

interface Props {
  item: ChecklistItem;
  readOnly: boolean;
  onChange: (payload: {
    result?: TResult | null;
    numericValue?: number | null;
    notes?: string | null;
  }) => void;
  changing: boolean;
}

function resultLabel(r: TResult | null) {
  if (r === null) return 'Unmarked';
  if (r === ChecklistItemResult.Pass) return 'Pass';
  if (r === ChecklistItemResult.Fail) return 'Fail';
  return 'N/A';
}

function resultVariant(r: TResult | null) {
  if (r === ChecklistItemResult.Pass) return 'pass';
  if (r === ChecklistItemResult.Fail) return 'fail';
  if (r === ChecklistItemResult.NA) return 'na';
  return 'none';
}

function formatThreshold(item: ChecklistItem) {
  const parts: string[] = [];
  if (item.minThreshold != null && item.maxThreshold != null) {
    parts.push(`must be between ${item.minThreshold} and ${item.maxThreshold}`);
  } else if (item.minThreshold != null) {
    parts.push(`must be ≥ ${item.minThreshold}`);
  } else if (item.maxThreshold != null) {
    parts.push(`must be ≤ ${item.maxThreshold}`);
  }
  return parts.join(' · ');
}

export function ChecklistItemRow({
  item,
  readOnly,
  onChange,
  changing,
}: Props) {
  const [notes, setNotes] = useState<string>(item.notes ?? '');
  const [numericDraft, setNumericDraft] = useState<string>(
    item.numericValue?.toString() ?? '',
  );

  const variant = resultVariant(item.result);
  const hint = formatThreshold(item);

  const statusIcon = useMemo(() => {
    if (variant === 'pass')
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    if (variant === 'fail')
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    if (variant === 'na')
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      );
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }, [variant]);

  const pickResult = (r: TResult | null) => {
    if (readOnly || changing) return;
    onChange({ result: r, notes: notes.trim() || null });
  };

  const applyNumeric = () => {
    if (readOnly || changing) return;
    const trimmed = numericDraft.trim();
    if (trimmed === '') {
      onChange({ numericValue: null, notes: notes.trim() || null });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    // When user enters a numeric value, send result as null explicitly — the backend auto-evaluates.
    // Passing undefined result preserves the current item result for text items;
    // for numeric we explicitly want to let backend determine, so send null only if value changed
    // But only send result: null if we want backend to recompute; we can send undefined to leave as-is
    // Let's send numericValue only (result will be auto-set by backend via invalidation/refetch)
    onChange({
      numericValue: n,
      result: undefined,
      notes: notes.trim() || null,
    });
  };

  const commitNotes = () => {
    if (readOnly || changing) return;
    onChange({ notes: notes.trim() || null });
  };

  return (
    <div className={`item-row item-${variant}`}>
      <div className="item-left">
        <div className={`item-status-indicator status-${variant}`}>
          {statusIcon}
        </div>
      </div>

      <div className="item-body">
        <div className="item-text-wrapper">
          <div className="item-text">{item.text}</div>
          {item.referenceDocument && (
            <div className="item-reference">{item.referenceDocument}</div>
          )}
          <div className="item-meta-small">
            {item.result !== null && (
              <span className={`item-result-pill pill-${variant}`}>
                {resultLabel(item.result)}
              </span>
            )}
            {item.completedAt && item.completedBy && (
              <span className="item-timestamp">
                {item.completedBy} · {new Date(item.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="item-controls">
          {item.itemType === ChecklistItemType.Text ? (
            <div className={`seg-control ${changing ? 'disabled' : ''}`} role="group" aria-label="Result">
              <button
                type="button"
                className={`seg-btn ${variant === 'pass' ? 'seg-pass' : ''}`}
                onClick={() => pickResult(ChecklistItemResult.Pass)}
                disabled={readOnly || changing}
                aria-pressed={variant === 'pass'}
              >
                <span className="seg-icon">✓</span>
                <span>Pass</span>
              </button>
              <button
                type="button"
                className={`seg-btn ${variant === 'fail' ? 'seg-fail' : ''}`}
                onClick={() => pickResult(ChecklistItemResult.Fail)}
                disabled={readOnly || changing}
                aria-pressed={variant === 'fail'}
              >
                <span className="seg-icon">✕</span>
                <span>Fail</span>
              </button>
              {item.allowNA && (
                <button
                  type="button"
                  className={`seg-btn ${variant === 'na' ? 'seg-na' : ''}`}
                  onClick={() => pickResult(ChecklistItemResult.NA)}
                  disabled={readOnly || changing}
                  aria-pressed={variant === 'na'}
                >
                  <span className="seg-icon">—</span>
                  <span>N/A</span>
                </button>
              )}
              {variant === 'none' && !readOnly && (
                <button
                  type="button"
                  className="seg-btn seg-clear"
                  onClick={() => pickResult(null)}
                  disabled
                  aria-pressed={true}
                  style={{ opacity: 0.6 }}
                >
                  <span className="seg-icon">○</span>
                  <span>Unmarked</span>
                </button>
              )}
            </div>
          ) : (
            <div className="numeric-control">
              <div className="numeric-input-row">
                <input
                  type="number"
                  className="numeric-input"
                  inputMode="decimal"
                  step="any"
                  value={numericDraft}
                  disabled={readOnly || changing}
                  placeholder="Enter value"
                  onChange={(e) => setNumericDraft(e.target.value)}
                  onBlur={applyNumeric}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={applyNumeric}
                  disabled={readOnly || changing}
                >
                  Apply
                </button>
              </div>
              {hint && <div className="numeric-hint">{hint}</div>}
              {item.numericValue != null && (
                <div className="numeric-current">
                  Last saved: <strong>{item.numericValue}</strong>
                  {item.result === ChecklistItemResult.Pass && (
                    <span className="ok-tag">Pass</span>
                  )}
                  {item.result === ChecklistItemResult.Fail && (
                    <span className="bad-tag">Fail — outside thresholds</span>
                  )}
                  {item.result === ChecklistItemResult.NA && (
                    <span className="na-tag">N/A</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="item-notes">
          <label className="field-label">
            Notes
            {item.requiresNoteOnFail &&
              item.result === ChecklistItemResult.Fail && (
                <span className="required-dot" title="Required">*</span>
              )}
          </label>
          <textarea
            className="notes-input"
            rows={2}
            placeholder={
              item.requiresNoteOnFail &&
              item.result === ChecklistItemResult.Fail
                ? 'Required: describe the failure and corrective action…'
                : 'Optional notes…'
            }
            value={notes}
            disabled={readOnly || changing}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={commitNotes}
          />
        </div>
      </div>
    </div>
  );
}
