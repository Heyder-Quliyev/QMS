import type {
  ChecklistInstanceDetail,
  ChecklistInstanceSummary,
  UpdateChecklistItemPayload,
} from '../types';

const API_BASE = '/api/Checklist';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      if (errData?.title) msg = errData.title;
      else if (typeof errData === 'string') msg = errData;
      else if (errData?.errors) {
        const first = Object.values(errData.errors)[0];
        if (Array.isArray(first) && first[0]) msg = first[0] as string;
      }
    } catch {}
    throw new Error(msg);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

export async function getChecklistInstances(): Promise<ChecklistInstanceSummary[]> {
  return fetchJson<ChecklistInstanceSummary[]>(API_BASE);
}

export async function getChecklistInstance(id: number): Promise<ChecklistInstanceDetail> {
  return fetchJson<ChecklistInstanceDetail>(`${API_BASE}/${encodeURIComponent(id)}`);
}

export async function patchChecklistItem(
  instanceId: number,
  itemId: number,
  payload: UpdateChecklistItemPayload,
): Promise<unknown> {
  return fetchJson<unknown>(
    `${API_BASE}/${encodeURIComponent(instanceId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export async function completeChecklist(instanceId: number): Promise<unknown> {
  return fetchJson<unknown>(`${API_BASE}/${encodeURIComponent(instanceId)}/complete`, {
    method: 'POST',
    body: '{}',
  });
}
