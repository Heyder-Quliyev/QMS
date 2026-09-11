import { useEffect, useMemo, useState } from 'react';
import type { ChecklistItem, ChecklistItemResult as TResult } from '../types';
import { ChecklistItemResult, ChecklistItemType } from '../types';

interface ChangePayload {
  result?: TResult | null;
  numericValue?: number | null;
  textValue?: string | null;
  notes?: string | null;
  photoPath?: string | null;
  validateRequired?: boolean;
}

interface Props {
  item: ChecklistItem;
  readOnly: boolean;
  onChange: (payload: ChangePayload) => void;
  onUploadPhoto: (file: File) => void;
  changing: boolean;
  uploadingPhoto: boolean;
}

function normalize(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resultLabel(item: ChecklistItem) {
  if (item.itemType === ChecklistItemType.YesNo) {
    if (item.result === ChecklistItemResult.Pass) return 'Yes';
    if (item.result === ChecklistItemResult.Fail) return 'No';
    if (item.result === ChecklistItemResult.NA) return 'N/A';
    return null;
  }

  if (item.itemType === ChecklistItemType.Text) {
    return item.textValue ? 'Answered' : null;
  }

  if (item.itemType === ChecklistItemType.PhotoRequired) {
    return item.photoPath ? 'Photo Attached' : null;
  }

  if (item.result === null) return null;
  if (item.result === ChecklistItemResult.Pass) return 'Pass';
  if (item.result === ChecklistItemResult.Fail) return 'Fail';
  return 'N/A';
}

function resultVariant(item: ChecklistItem) {
  if (item.itemType === ChecklistItemType.Text) {
    return item.textValue ? 'pass' : 'none';
  }

  if (item.itemType === ChecklistItemType.PhotoRequired) {
    return item.photoPath ? 'pass' : 'none';
  }

  if (item.result === ChecklistItemResult.Pass) return 'pass';
  if (item.result === ChecklistItemResult.Fail) return 'fail';
  if (item.result === ChecklistItemResult.NA) return 'na';
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

function controlLabel(item: ChecklistItem) {
  switch (item.itemType) {
    case ChecklistItemType.PassFail:
      return 'Pass / Fail';
    case ChecklistItemType.YesNo:
      return 'Yes / No';
    case ChecklistItemType.Text:
      return 'Text Answer';
    case ChecklistItemType.Number:
      return 'Numeric Answer';
    case ChecklistItemType.PhotoRequired:
      return 'Photo Upload';
    default:
      return 'Answer';
  }
}

export function ChecklistItemRow({
  item,
  readOnly,
  onChange,
  onUploadPhoto,
  changing,
  uploadingPhoto,
}: Props) {
  const [notes, setNotes] = useState(item.notes ?? '');
  const [numericDraft, setNumericDraft] = useState(item.numericValue?.toString() ?? '');
  const [textDraft, setTextDraft] = useState(item.textValue ?? '');

  useEffect(() => {
    setNotes(item.notes ?? '');
  }, [item.notes]);

  useEffect(() => {
    setNumericDraft(item.numericValue?.toString() ?? '');
  }, [item.numericValue]);

  useEffect(() => {
    setTextDraft(item.textValue ?? '');
  }, [item.textValue]);

  const variant = resultVariant(item);
  const hint = formatThreshold(item);
  const pillLabel = resultLabel(item);

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

  const buildPayload = (patch: ChangePayload = {}): ChangePayload => ({
    result: patch.result !== undefined ? patch.result : item.result,
    numericValue:
      patch.numericValue !== undefined ? patch.numericValue : item.numericValue,
    textValue: patch.textValue !== undefined ? patch.textValue : item.textValue,
    notes: patch.notes !== undefined ? patch.notes : normalize(notes),
    photoPath: patch.photoPath !== undefined ? patch.photoPath : item.photoPath,
    validateRequired:
      patch.validateRequired !== undefined ? patch.validateRequired : true,
  });

  const submit = (patch: ChangePayload) => {
    if (readOnly || changing) return;
    onChange(buildPayload(patch));
  };

  const applyNumeric = () => {
    const trimmed = numericDraft.trim();
    if (trimmed === '') {
      submit({ numericValue: null, validateRequired: true });
      return;
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value)) return;
    submit({ numericValue: value, validateRequired: true });
  };

  const applyText = () => {
    submit({ textValue: normalize(textDraft), validateRequired: true });
  };

  const commitNotes = () => {
    submit({ notes: normalize(notes), validateRequired: false });
  };

  const renderBinaryButtons = (
    passLabel: string,
    failLabel: string,
    ariaLabel: string,
  ) => (
    <div className={`seg-control ${changing ? 'disabled' : ''}`} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={`seg-btn ${item.result === ChecklistItemResult.Pass ? 'seg-pass' : ''}`}
        onClick={() => submit({ result: ChecklistItemResult.Pass, validateRequired: true })}
        disabled={readOnly || changing}
        aria-pressed={item.result === ChecklistItemResult.Pass}
      >
        <span className="seg-icon">✓</span>
        <span>{passLabel}</span>
      </button>
      <button
        type="button"
        className={`seg-btn ${item.result === ChecklistItemResult.Fail ? 'seg-fail' : ''}`}
        onClick={() => submit({ result: ChecklistItemResult.Fail, validateRequired: true })}
        disabled={readOnly || changing}
        aria-pressed={item.result === ChecklistItemResult.Fail}
      >
        <span className="seg-icon">✕</span>
        <span>{failLabel}</span>
      </button>
      {item.allowNA && (
        <button
          type="button"
          className={`seg-btn ${item.result === ChecklistItemResult.NA ? 'seg-na' : ''}`}
          onClick={() => submit({ result: ChecklistItemResult.NA, validateRequired: true })}
          disabled={readOnly || changing}
          aria-pressed={item.result === ChecklistItemResult.NA}
        >
          <span className="seg-icon">—</span>
          <span>N/A</span>
        </button>
      )}
    </div>
  );

  const renderControls = () => {
    switch (item.itemType) {
      case ChecklistItemType.PassFail:
        return renderBinaryButtons('Pass', 'Fail', 'Pass or fail');
      case ChecklistItemType.YesNo:
        return renderBinaryButtons('Yes', 'No', 'Yes or no');
      case ChecklistItemType.Text:
        return (
          <div className="text-answer-control">
            <div className="numeric-input-row">
              <input
                type="text"
                className="form-input text-answer-input"
                value={textDraft}
                disabled={readOnly || changing}
                placeholder="Enter answer"
                onChange={(e) => setTextDraft(e.target.value)}
                onBlur={applyText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyText();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={applyText}
                disabled={readOnly || changing}
              >
                Apply
              </button>
            </div>
            {item.textValue && (
              <div className="text-answer-preview">
                Last saved: <strong>{item.textValue}</strong>
              </div>
            )}
          </div>
        );
      case ChecklistItemType.Number:
        return (
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
                    applyNumeric();
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
        );
      case ChecklistItemType.PhotoRequired:
        return (
          <div className="photo-control">
            <label className={`photo-upload-btn${readOnly || changing || uploadingPhoto ? ' disabled' : ''}`}>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                disabled={readOnly || changing || uploadingPhoto}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadPhoto(file);
                  e.currentTarget.value = '';
                }}
              />
              <span>{uploadingPhoto ? 'Uploading…' : 'Upload Photo / File'}</span>
            </label>
            {item.photoPath ? (
              <a className="photo-link" href={item.photoPath} target="_blank" rel="noreferrer">
                Attached file
              </a>
            ) : (
              <div className="photo-missing-hint">
                {item.isRequired ? 'Required before submission' : 'Optional attachment'}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
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
            <span className="item-type-pill">{controlLabel(item)}</span>
            {pillLabel && (
              <span className={`item-result-pill pill-${variant}`}>
                {pillLabel}
              </span>
            )}
            {item.completedAt && item.completedBy && (
              <span className="item-timestamp">
                {item.completedBy} · {new Date(item.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="item-controls">{renderControls()}</div>

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
