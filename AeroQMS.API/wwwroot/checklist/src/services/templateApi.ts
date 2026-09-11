import type {
  ChecklistTemplateDetail,
  CreateTemplatePayload,
  UpdateTemplatePayload,
} from '../types';

const TEMPLATE_API = '/api/checklist-templates';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errData = await res.json().catch(() => null);
      if (typeof errData?.message === 'string') msg = errData.message;
      else if (errData?.title) msg = errData.title;
      else if (typeof errData === 'string') msg = errData;
    } catch {}
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function getTemplates(): Promise<ChecklistTemplateDetail[]> {
  return fetchJson<ChecklistTemplateDetail[]>(TEMPLATE_API);
}

export async function getTemplate(id: number): Promise<ChecklistTemplateDetail> {
  return fetchJson<ChecklistTemplateDetail>(`${TEMPLATE_API}/${encodeURIComponent(id)}`);
}

export async function createTemplate(
  payload: CreateTemplatePayload,
): Promise<{ templateId: number }> {
  return fetchJson<{ templateId: number }>(TEMPLATE_API, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(
  id: number,
  payload: UpdateTemplatePayload,
): Promise<{ templateId: number }> {
  return fetchJson<{ templateId: number }>(`${TEMPLATE_API}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplate(id: number): Promise<void> {
  await fetchJson<void>(`${TEMPLATE_API}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
