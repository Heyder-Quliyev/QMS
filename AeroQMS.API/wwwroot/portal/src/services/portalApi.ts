const API_BASE = '/api/portal';

// Helper for fetch with error handling
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  console.log('apiFetch calling:', `${API_BASE}${url}`, options);
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  console.log('apiFetch response status:', response.status, response.statusText);
  if (!response.ok) {
    const text = await response.text();
    console.error('apiFetch error:', text);
    throw new Error(text || 'API Error');
  }
  // Handle 204 No Content (empty body) or empty body
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  // Read as text first, then parse to JSON if not empty
  const text = await response.text();
  let data: T;
  try {
    data = text ? JSON.parse(text) : undefined as T;
  } catch (err) {
    console.warn('apiFetch: Could not parse JSON, returning empty object:', err);
    data = {} as T;
  }
  console.log('apiFetch success:', data);
  return data;
}

// Portal Groups
export async function getPortalGroups() {
  return apiFetch<any[]>('/groups');
}
export async function createPortalGroup(data: { name: string; slug: string }) {
  return apiFetch('/groups', { method: 'POST', body: JSON.stringify(data) });
}
export async function deletePortalGroup(id: number) {
  return apiFetch(`/groups/${id}`, { method: 'DELETE' });
}

// Portal Documents
export async function getGroupDocuments(groupId: number) {
  return apiFetch<any[]>(`/groups/${groupId}/documents`);
}
export async function getAllDocuments() {
  return apiFetch<any[]>('/documents');
}
export async function addDocumentToGroup(groupId: number, documentId: number) {
  return apiFetch<any>(`/groups/${groupId}/documents`, { 
    method: 'POST', 
    body: JSON.stringify({ documentId }) 
  });
}
export async function removeDocumentFromGroup(groupId: number, portalDocumentId: number) {
  const url = `/groups/${groupId}/documents/${portalDocumentId}`;
  console.log('removeDocumentFromGroup URL:', url); // debug
  return apiFetch(url, { method: 'DELETE' });
}

// Portal Users
export async function getGroupUsers(groupId: number) {
  return apiFetch<any[]>(`/groups/${groupId}/users`);
}
export async function inviteUser(groupId: number, email: string, name: string) {
  return apiFetch<any>(`/groups/${groupId}/users/invite`, { 
    method: 'POST', 
    body: JSON.stringify({ email, name }) 
  });
}
export async function revokeUser(portalUserId: number) {
  const url = `/users/${portalUserId}`;
  console.log('revokeUser URL:', url); // debug
  return apiFetch(url, { method: 'DELETE' });
}
export async function regenerateToken(groupId: number, userId: number, sendEmail = false) {
  return apiFetch<any>(`/groups/${groupId}/users/${userId}/regenerate-token?sendEmail=${sendEmail}`, { method: 'POST' });
}

// --- Token-Based Portal APIs ---
export async function getPortalByToken(token: string) {
  return apiFetch<any>(`/access/${token}`);
}

export async function viewDocument(token: string, docId: number) {
  return fetch(`${API_BASE}/access/${token}/documents/${docId}/view`);
}

export async function downloadDocument(token: string, docId: number) {
  return fetch(`${API_BASE}/access/${token}/documents/${docId}/download`);
}

export async function submitFeedback(token: string, data: { documentId?: number; email?: string; message: string }) {
  return apiFetch(`/access/${token}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// Portal Logs
export async function getGroupLogs(groupId: number) {
  return apiFetch<any[]>('/groups/' + groupId + '/logs');
}

export async function getGroupFeedback(groupId: number) {
  return apiFetch<any[]>('/groups/' + groupId + '/feedback');
}
export async function logAction(data: { portalUserId: number; documentId: number; action: string }) {
  return apiFetch('/log', { method: 'POST', body: JSON.stringify(data) });
}

// --- Legacy Public Portal APIs (deprecated) ---
export async function getPublicPortal(slug: string) {
  return apiFetch(`/public/${slug}`);
}
export async function viewPublicDocument(slug: string, docId: number) {
  return fetch(`${API_BASE}/public/${slug}/documents/${docId}/view`);
}
export async function downloadPublicDocument(slug: string, docId: number) {
  return fetch(`${API_BASE}/public/${slug}/documents/${docId}/download`);
}
export async function submitPublicFeedback(slug: string, data: { documentId?: number; email?: string; message: string }) {
  return apiFetch(`/public/${slug}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// External Portal
export async function getExternalPortal(slug: string) {
  return apiFetch(`/external/${slug}`);
}
