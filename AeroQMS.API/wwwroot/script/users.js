function usersDeps() {
  return window.__usersDeps || {};
}

function usersApiBaseUrl() {
  return usersDeps().API_BASE_URL || '/api';
}

function usersEscapeHtml(value) {
  const fn = usersDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function usersIsAdminUser() {
  const fn = usersDeps().isAdminUser;
  return typeof fn === 'function' ? fn() : false;
}

function usersShowToast(message, type) {
  const fn = usersDeps().showToast;
  if (typeof fn === 'function') fn(message, type);
}

function usersCloseModal() {
  const fn = usersDeps().closeModal;
  if (typeof fn === 'function') fn();
}

async function populateWorkflowUsers(selectId, selectedUserId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Anyone with the role above</option>';
  try {
    const res = await fetch(`${usersApiBaseUrl()}/users/lookup?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const users = await res.json();
    (users || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.name}`;
      sel.appendChild(opt);
    });
    if (selectedUserId != null && selectedUserId !== '') sel.value = String(selectedUserId);
  } catch {}
}

async function fetchUsersAdmin() {
  if (!usersIsAdminUser()) {
    const tbody = document.getElementById('users-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--text-muted); text-align:center;">403 — Admin only</td></tr>';
    return;
  }

  const tbody = document.getElementById('users-table-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--text-muted); text-align:center;">Loading users...</td></tr>';

  try {
    const res = await fetch(`${usersApiBaseUrl()}/users?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--accent3); text-align:center;">Error loading users</td></tr>';
      return;
    }
    const users = await res.json();
    usersAdminCache = users || [];
    renderUsersTable(usersAdminCache);
  } catch {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--accent3); text-align:center;">Error loading users</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--text-muted); text-align:center;">No users found</td></tr>';
    return;
  }

  const formatDt = (v) => {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString();
  };

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${usersEscapeHtml(u.name || '')}</td>
      <td>${usersEscapeHtml(u.email || '')}</td>
      <td><span class="badge badge-blue">${usersEscapeHtml(u.role || '')}</span></td>
      <td>${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td>${usersEscapeHtml(formatDt(u.last_login))}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="openEditUserModal(${u.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          ${u.is_active ? `<button class="btn-icon" title="Deactivate" onclick="deactivateUser(${u.id})" style="border-color: rgba(255,107,53,0.25); color: var(--accent3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>` : ''}
          <button class="btn-icon" title="Reset Password" onclick="openResetPasswordModal(${u.id})" style="border-color: rgba(59,139,255,0.25); color: var(--accent2);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M20 9A8 8 0 0 0 6.34 6.34L4 10"/><path d="M4 14a8 8 0 0 0 13.66 3.66L20 14"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');
}

let usersAdminCache = [];
async function refreshUsersAdminCache() {
  const res = await fetch(`${usersApiBaseUrl()}/users?_=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const users = await res.json();
  usersAdminCache = users || [];
  return usersAdminCache;
}

function resetRecordModalForCustomForm() {
  const fields = document.getElementById('form-fields');
  const id = document.getElementById('form-id');
  const form = document.getElementById('record-form');
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (id) id.value = '';
  if (fields) fields.innerHTML = '';
  if (btn) btn.style.display = 'inline-flex';
  if (form) form.onsubmit = usersDeps().submitRecord;
}

function openAddUserModal() {
  if (!usersIsAdminUser()) return;
  resetRecordModalForCustomForm();
  document.getElementById('modal-title').textContent = 'Add User';
  document.getElementById('form-fields').innerHTML = `
    <div class="form-group"><label class="form-label required">Full Name</label><input class="form-input" id="user-name" type="text"></div>
    <div class="form-group"><label class="form-label required">Email</label><input class="form-input" id="user-email" type="email"></div>
    <div class="form-group"><label class="form-label required">Role</label>
      <select class="form-input" id="user-role">
        <option value="Admin">Admin</option>
        <option value="Quality Manager">Quality Manager</option>
        <option value="Document Owner">Document Owner</option>
        <option value="Department Head">Department Head</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label required">Temporary Password</label><input class="form-input" id="user-password" type="password"></div>
    <label class="checkbox-label" style="margin-top:6px;"><input type="checkbox" id="user-force-change" checked><span>Force password change on first login</span></label>
  `;
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (saveBtn) saveBtn.textContent = 'Create User';
  const form = document.getElementById('record-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    await submitCreateUser();
  };
  document.getElementById('modal-overlay').classList.add('active');
}

async function submitCreateUser() {
  const name = (document.getElementById('user-name')?.value || '').trim();
  const email = (document.getElementById('user-email')?.value || '').trim();
  const role = document.getElementById('user-role')?.value || '';
  const password = document.getElementById('user-password')?.value || '';
  const forcePasswordChange = !!document.getElementById('user-force-change')?.checked;

  if (!name || !email || !role || !password) {
    usersShowToast('All fields are required', 'error');
    return;
  }

  try {
    const res = await fetch(`${usersApiBaseUrl()}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, password, role, forcePasswordChange })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      usersShowToast(data?.error || 'Failed to create user', 'error');
      return;
    }
    usersShowToast('User created', 'success');
    usersCloseModal();
    await fetchUsersAdmin();
  } catch {
    usersShowToast('Failed to create user', 'error');
  }
}

async function openEditUserModal(id) {
  if (!usersIsAdminUser()) return;
  if (usersAdminCache.length === 0) await refreshUsersAdminCache();
  const u = usersAdminCache.find(x => x.id === id);
  if (!u) { usersShowToast('User not found', 'error'); return; }

  resetRecordModalForCustomForm();
  document.getElementById('modal-title').textContent = 'Edit User';
  document.getElementById('form-fields').innerHTML = `
    <div class="form-group"><label class="form-label required">Full Name</label><input class="form-input" id="edit-user-name" type="text" value="${usersEscapeHtml(u.name || '')}"></div>
    <div class="form-group"><label class="form-label required">Email</label><input class="form-input" id="edit-user-email" type="email" value="${usersEscapeHtml(u.email || '')}"></div>
    <div class="form-group"><label class="form-label required">Role</label>
      <select class="form-input" id="edit-user-role">
        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
        <option value="Quality Manager" ${u.role === 'Quality Manager' ? 'selected' : ''}>Quality Manager</option>
        <option value="Document Owner" ${u.role === 'Document Owner' ? 'selected' : ''}>Document Owner</option>
        <option value="Department Head" ${u.role === 'Department Head' ? 'selected' : ''}>Department Head</option>
      </select>
    </div>
  `;
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (saveBtn) saveBtn.textContent = 'Save';
  const form = document.getElementById('record-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    await submitUpdateUser(id);
  };
  document.getElementById('modal-overlay').classList.add('active');
}

async function submitUpdateUser(id) {
  const name = (document.getElementById('edit-user-name')?.value || '').trim();
  const email = (document.getElementById('edit-user-email')?.value || '').trim();
  const role = document.getElementById('edit-user-role')?.value || '';
  if (!name || !email || !role) {
    usersShowToast('All fields are required', 'error');
    return;
  }
  try {
    const res = await fetch(`${usersApiBaseUrl()}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      usersShowToast(data?.error || 'Failed to update user', 'error');
      return;
    }
    usersShowToast('User updated', 'success');
    usersCloseModal();
    await fetchUsersAdmin();
  } catch {
    usersShowToast('Failed to update user', 'error');
  }
}

async function deactivateUser(id) {
  if (!usersIsAdminUser()) return;
  if (!confirm('Deactivate this user?')) return;
  try {
    const res = await fetch(`${usersApiBaseUrl()}/users/${id}/deactivate`, { method: 'POST', headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      usersShowToast(data?.error || 'Failed to deactivate user', 'error');
      return;
    }
    usersShowToast('User deactivated', 'success');
    await fetchUsersAdmin();
  } catch {
    usersShowToast('Failed to deactivate user', 'error');
  }
}

function openResetPasswordModal(id) {
  if (!usersIsAdminUser()) return;
  resetRecordModalForCustomForm();
  document.getElementById('modal-title').textContent = 'Reset Password';
  document.getElementById('form-fields').innerHTML = `
    <div class="form-group"><label class="form-label required">New Temporary Password</label><input class="form-input" id="reset-pass" type="password"></div>
    <label class="checkbox-label" style="margin-top:6px;"><input type="checkbox" id="reset-force-change" checked><span>Force password change on next login</span></label>
  `;
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (saveBtn) saveBtn.textContent = 'Reset';
  const form = document.getElementById('record-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    await submitResetPassword(id);
  };
  document.getElementById('modal-overlay').classList.add('active');
}

async function submitResetPassword(id) {
  const password = document.getElementById('reset-pass')?.value || '';
  const forcePasswordChange = !!document.getElementById('reset-force-change')?.checked;
  if (!password) { usersShowToast('Password is required', 'error'); return; }
  try {
    const res = await fetch(`${usersApiBaseUrl()}/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ password, forcePasswordChange })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      usersShowToast(data?.error || 'Failed to reset password', 'error');
      return;
    }
    usersShowToast('Password reset', 'success');
    usersCloseModal();
    await fetchUsersAdmin();
  } catch {
    usersShowToast('Failed to reset password', 'error');
  }
}
