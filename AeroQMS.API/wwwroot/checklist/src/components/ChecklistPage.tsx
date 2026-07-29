import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useChecklistInstance,
  useCompleteChecklist,
  useUpdateChecklistItem,
} from '../hooks/useChecklist';
import { ChecklistHeader } from './ChecklistHeader';
import { ProgressBar } from './ProgressBar';
import { ChecklistItemRow } from './ChecklistItemRow';
import { ChecklistInstanceStatus } from '../types';
import type { ChecklistItem, ChecklistItemResult as TResult } from '../types';

function readInstanceId(): number | null {
  const params = useParams();
  const raw = params.instanceId;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function ChecklistPage() {
  const instanceId = readInstanceId();
  const { data, isFetching, isLoading, error } = useChecklistInstance(instanceId);
  const updateMut = useUpdateChecklistItem();
  const completeMut = useCompleteChecklist();
  const [toast, setToast] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const isReadOnly = useMemo(() => {
    if (!data) return false;
    return (
      data.status === ChecklistInstanceStatus.Completed ||
      data.status === ChecklistInstanceStatus.Voided
    );
  }, [data]);

  const total = data?.items?.length ?? 0;
  const complete = data?.items?.filter((i) => i.result != null).length ?? 0;

  const onItemChange = (
    item: ChecklistItem,
    payload: {
      result?: TResult | null;
      numericValue?: number | null;
      notes?: string | null;
    },
  ) => {
    if (instanceId == null) return;
    const { result, numericValue, notes } = payload;

    // Only send fields that were explicitly provided (not undefined)
    const patch: any = {};
    if (result !== undefined) patch.result = result; // Allow null to clear
    if (numericValue !== undefined) patch.numericValue = numericValue; // Allow null to clear
    if (notes !== undefined) patch.notes = notes; // Allow null to clear

    // For numeric value submission, don't pass explicit result undefined/null mismatch.
    // If we explicitly want to not send a field, omit it.
    // Numeric-only update (numericValue defined but result = undefined): omit result
    if (
      numericValue !== undefined &&
      result === undefined &&
      data &&
      data.id != null
    ) {
      // Send only numericValue + notes if provided
      const numericPatch: any = {};
      numericPatch.numericValue = numericValue;
      if (notes !== undefined) numericPatch.notes = notes;
      updateMut.mutate(
        {
          instanceId: data.id,
          itemId: item.id,
          payload: numericPatch,
        },
        {
          onError: (e: any) => {
            setToast({
              kind: 'error',
              text: e?.message ?? 'Failed to save numeric value. Changes reverted.',
            });
            setTimeout(() => setToast(null), 4500);
          },
        },
      );
      return;
    }

    updateMut.mutate(
      { instanceId, itemId: item.id, payload: patch },
      {
        onError: (e: any) => {
          setToast({
            kind: 'error',
            text: e?.message ?? 'Failed to save item. Changes reverted.',
          });
          setTimeout(() => setToast(null), 4500);
        },
      },
    );
  };

  const onComplete = () => {
    if (!data) return;
    completeMut.mutate(data.id, {
      onSuccess: () => {
        setToast({ kind: 'success', text: 'Checklist completed successfully.' });
        setTimeout(() => setToast(null), 3500);
      },
      onError: (e: any) => {
        setToast({
          kind: 'error',
          text: e?.message ?? 'Could not complete checklist.',
        });
        setTimeout(() => setToast(null), 4500);
      },
    });
  };

  if (!instanceId) {
    return (
      <div className="checklist-layout">
        <div className="checklist-empty">
          <h2>No checklist selected</h2>
          <p>Open a checklist from the main AeroQMS application.</p>
          <Link className="btn btn-primary" to="/">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="checklist-layout">
        <div className="loading-state">
          <div className="spinner" aria-hidden />
          <span>Loading checklist…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="checklist-layout">
        <div className="error-state">
          <h2>Unable to load checklist</h2>
          <p>{(error as any)?.message ?? 'The checklist could not be found.'}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checklist-layout">
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      <ChecklistHeader
        title={data.title}
        status={data.status}
        assignedTo={data.assignedTo}
        dueDate={data.dueDate}
        createdBy={data.createdBy}
        createdAt={data.createdAt}
        completedBy={data.completedBy}
        completedAt={data.completedAt}
        readOnly={isReadOnly}
        onComplete={onComplete}
        completing={completeMut.isPending}
      />

      <ProgressBar complete={complete} total={total} />

      <div className="items-list">
        {(data.items ?? []).map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            readOnly={isReadOnly}
            changing={updateMut.isPending}
            onChange={(payload) => onItemChange(item, payload)}
          />
        ))}
      </div>
    </div>
  );
}
