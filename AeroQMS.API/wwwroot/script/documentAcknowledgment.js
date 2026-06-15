async function refreshAckNavBadge() {
  const badge = document.getElementById('ack-nav-badge');
  if (!badge) return;
  try {
    const res = await fetch(`${API_BASE_URL}/documents/my-documents?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      badge.style.display = 'none';
      return;
    }
    const data = await res.json().catch(() => null);
    const count = data?.count ?? 0;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? '' : 'none';
  } catch {
    badge.style.display = 'none';
  }
}

async function loadDocumentAcknowledgment(documentId) {
  const el = document.getElementById('document-ack-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading acknowledgment...</div>';
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/summary?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || 'Failed');

    const stats = data.stats || {};
    const groups = data.groups || [];
    const perms = data.permissions || {};
    const pct = Math.max(0, Math.min(100, parseInt(stats.pct || 0, 10) || 0));
    const dash = `${pct}, 100`;
    const docTitle = data?.document?.title || '';
    const docRev = data?.document?.revision || '';
    const dueDate = stats.due_date ? new Date(stats.due_date).toLocaleDateString() : '-';
    const canManage = !!perms.can_manage;

    let isCurrentUserPending = false;
    const currentUserId = window.CURRENT_USER?.Id;
    if (currentUserId != null) {
      for (const g of (groups || [])) {
        for (const p of (g.personnel || [])) {
          if (p.user_id === currentUserId) {
            isCurrentUserPending = !p.acknowledged;
            break;
          }
        }
      }
    }

    el.innerHTML = `
      <div class="acknowledgment-tab">
        <div class="ack-stats">
          <div class="ack-stat">
            <div class="ack-progress-circle">
              <svg viewBox="0 0 36 36">
                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                <path class="circle" stroke-dasharray="${dash}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
              </svg>
              <span class="progress-value">${pct}%</span>
            </div>
            <div class="ack-stat-info">
              <strong>${escapeHtml(String(stats.acknowledged ?? 0))}/${escapeHtml(String(stats.total ?? 0))} Personnel</strong>
              <p>Have acknowledged this document • Due: ${escapeHtml(dueDate)}</p>
            </div>
          </div>
          <div class="ack-actions">
            ${isCurrentUserPending ? `<button type="button" class="btn btn-primary" onclick='openAckConfirmModal(${documentId}, ${JSON.stringify(docTitle)}, ${JSON.stringify(docRev)})'>I Have Read & Understood</button>` : ''}
            ${canManage ? `<button type="button" class="btn btn-primary" onclick="sendAckReminders(${documentId})">Send Reminders</button>` : ''}
            ${canManage ? `<button type="button" class="btn btn-ghost" onclick="exportAckReport(${documentId})">Export Report</button>` : ''}
          </div>
        </div>

        <div class="ack-groups">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <h3>Required Acknowledgment Groups</h3>
            ${canManage ? `<button type="button" class="btn btn-ghost" onclick="openAckRequirementModal(${documentId})">+ Add Required Group</button>` : ''}
          </div>

          ${(!groups || groups.length === 0) ? `<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">No acknowledgment requirements configured.</div>` : `
            ${groups.map(g => `
              <div class="ack-group-item">
                <div class="ack-group-header">
                  <div class="ack-group-info">
                    <strong>${escapeHtml(g.group || '')}</strong>
                    <span>${escapeHtml(String(g.acknowledged || 0))}/${escapeHtml(String(g.total || 0))} acknowledged</span>
                  </div>
                  <div class="ack-group-progress">
                    <div class="ack-progress-bar">
                      <div class="ack-progress-fill" style="width:${escapeHtml(String(g.pct || 0))}%"></div>
                    </div>
                    <span style="font-size:12px; font-weight:900;">${escapeHtml(String(g.pct || 0))}%</span>
                  </div>
                </div>
                <div class="ack-personnel">
                  ${(g.personnel || []).map(p => `
                    <div class="ack-person-item">
                      <div class="ack-person-left">
                        <div class="avatar-xs">${escapeHtml(initialsFromName(p.name))}</div>
                        <div class="ack-person-name" title="${escapeHtml(p.name || '')}">${escapeHtml(p.name || '')}</div>
                      </div>
                      <div class="ack-person-meta">
                        ${p.acknowledged ? `<span class="ack-date">${escapeHtml(formatAckDate(p.acknowledged_at))}</span>` : `<span class="pending-pill">Pending</span>`}
                        ${(!p.acknowledged && canManage) ? `<button type="button" class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="sendAckReminder(${documentId}, ${p.user_id})">Send Reminder</button>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          `}
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading acknowledgment.</div>';
  }
}

window.ackConfirmContext = { documentId: null, title: '', revision: '' };
function openAckConfirmModal(documentId, title, revision) {
  window.ackConfirmContext = { documentId, title: title || '', revision: revision || '' };
  const titleEl = document.getElementById('ack-confirm-doc-title');
  const revEl = document.getElementById('ack-confirm-doc-rev');
  const checkbox = document.getElementById('ack-confirm-checkbox');
  if (titleEl) titleEl.textContent = title || '';
  if (revEl) revEl.textContent = revision || '';
  if (checkbox) checkbox.checked = false;
  const overlay = document.getElementById('ack-confirm-modal');
  if (overlay) overlay.classList.add('active');
}

function closeAckConfirmModal() {
  const overlay = document.getElementById('ack-confirm-modal');
  if (overlay) overlay.classList.remove('active');
}

async function submitAcknowledgment() {
  const checkbox = document.getElementById('ack-confirm-checkbox');
  if (!checkbox || !checkbox.checked) return;
  const documentId = window.ackConfirmContext?.documentId;
  if (!documentId) return;
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
    if (!res.ok) throw new Error(await res.text());
    closeAckConfirmModal();
    await refreshAckNavBadge();
    await loadMyDocuments();
    const ackTab = document.getElementById('document-tab-ack');
    if (ackTab && ackTab.style.display !== 'none') await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

window.ackRequirementContext = { documentId: null };
window.ackReqMentionState = {
  initialized: false,
  users: null,
  selected: [],
  mentionActive: false,
  query: '',
  results: [],
  activeIndex: 0
};

function ackReqGetMentionBox() {
  return document.getElementById('ack-req-custom-role');
}

function ackReqGetSuggestBox() {
  return document.getElementById('ack-req-custom-role-suggest');
}

function ackReqEnsureUsersLoaded() {
  if (Array.isArray(window.ackReqMentionState.users)) return Promise.resolve(window.ackReqMentionState.users);
  return fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' })
    .then(async res => {
      if (!res.ok) return [];
      const users = await res.json().catch(() => []);
      window.ackReqMentionState.users = Array.isArray(users) ? users : [];
      return window.ackReqMentionState.users;
    })
    .catch(() => []);
}

function ackReqRenderMentionBox() {
  const box = ackReqGetMentionBox();
  if (!box) return;
  box.innerHTML = '';
  (window.ackReqMentionState.selected || []).forEach(u => {
    const chip = document.createElement('span');
    chip.className = 'badge badge-blue';
    chip.setAttribute('data-user-id', String(u.id));
    chip.setAttribute('contenteditable', 'false');
    chip.textContent = u.name || u.email || `User ${u.id}`;
    chip.onclick = () => {
      window.ackReqMentionState.selected = (window.ackReqMentionState.selected || []).filter(x => x.id !== u.id);
      ackReqRenderMentionBox();
    };
    box.appendChild(chip);
    box.appendChild(document.createTextNode(' '));
  });
  if (window.ackReqMentionState.mentionActive) {
    box.appendChild(document.createTextNode(`@${window.ackReqMentionState.query || ''}`));
  } else {
    box.appendChild(document.createTextNode(''));
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
  }
}

function ackReqCloseSuggestions() {
  const suggest = ackReqGetSuggestBox();
  if (suggest) {
    suggest.hidden = true;
    suggest.innerHTML = '';
  }
  window.ackReqMentionState.results = [];
  window.ackReqMentionState.activeIndex = 0;
}

function ackReqUpdateSuggestions() {
  const suggest = ackReqGetSuggestBox();
  if (!suggest) return;
  if (!window.ackReqMentionState.mentionActive) {
    ackReqCloseSuggestions();
    return;
  }
  const q = (window.ackReqMentionState.query || '').trim().toLowerCase();
  const users = Array.isArray(window.ackReqMentionState.users) ? window.ackReqMentionState.users : [];
  const selectedIds = new Set((window.ackReqMentionState.selected || []).map(u => u.id));
  const matches = users
    .filter(u => !selectedIds.has(u.id))
    .filter(u => {
      if (!q) return true;
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .slice(0, 8);

  window.ackReqMentionState.results = matches;
  window.ackReqMentionState.activeIndex = 0;

  if (matches.length === 0) {
    suggest.hidden = true;
    suggest.innerHTML = '';
    return;
  }

  suggest.hidden = false;
  suggest.innerHTML = matches.map((u, idx) => {
    const label = `${escapeHtml(u.name || '')}${u.email ? ` (${escapeHtml(u.email)})` : ''}`;
    const active = idx === (window.ackReqMentionState.activeIndex || 0);
    return `<button type="button" class="btn btn-ghost" data-idx="${idx}" data-user-id="${u.id}" aria-selected="${active ? 'true' : 'false'}">${label}</button>`;
  }).join('');

  Array.from(suggest.querySelectorAll('button[data-user-id]')).forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-user-id') || '', 10);
      if (!isNaN(id)) ackReqSelectUserById(id);
    };
  });
}

function ackReqSelectUserById(userId) {
  const users = Array.isArray(window.ackReqMentionState.users) ? window.ackReqMentionState.users : [];
  const user = users.find(u => u.id === userId);
  if (!user) {
    showToast('User not found', 'error');
    return;
  }
  const exists = (window.ackReqMentionState.selected || []).some(u => u.id === userId);
  if (!exists) window.ackReqMentionState.selected = [...(window.ackReqMentionState.selected || []), user];
  window.ackReqMentionState.mentionActive = false;
  window.ackReqMentionState.query = '';
  ackReqCloseSuggestions();
  ackReqRenderMentionBox();
}

function ackReqTrySelectActiveResult() {
  const results = window.ackReqMentionState.results || [];
  const idx = window.ackReqMentionState.activeIndex || 0;
  const pick = results[idx] || results[0];
  if (!pick) {
    showToast('No matching user found', 'error');
    return false;
  }
  ackReqSelectUserById(pick.id);
  return true;
}

function ackReqInitMentionInputOnce() {
  if (window.ackReqMentionState.initialized) return;
  window.ackReqMentionState.initialized = true;
  const box = ackReqGetMentionBox();
  if (!box) return;

  box.addEventListener('keydown', async (e) => {
    const roleSel = document.getElementById('ack-req-role');
    const isActive = roleSel && roleSel.value === 'custom';
    if (!isActive) return;

    const key = e.key;
    const isMention = window.ackReqMentionState.mentionActive;

    if (!isMention) {
      if (key === '@') {
        e.preventDefault();
        window.ackReqMentionState.mentionActive = true;
        window.ackReqMentionState.query = '';
        await ackReqEnsureUsersLoaded();
        ackReqRenderMentionBox();
        ackReqUpdateSuggestions();
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        const selected = window.ackReqMentionState.selected || [];
        if (selected.length > 0) {
          window.ackReqMentionState.selected = selected.slice(0, -1);
          ackReqRenderMentionBox();
        }
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        return;
      }
      if (key.length === 1) {
        e.preventDefault();
        showToast('Type "@" to search and select users', 'error');
      }
      return;
    }

    if (key === 'Escape') {
      e.preventDefault();
      window.ackReqMentionState.mentionActive = false;
      window.ackReqMentionState.query = '';
      ackReqCloseSuggestions();
      ackReqRenderMentionBox();
      return;
    }

    if (key === 'Enter' || key === 'Tab') {
      e.preventDefault();
      ackReqTrySelectActiveResult();
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      const max = (window.ackReqMentionState.results || []).length;
      if (max > 0) {
        window.ackReqMentionState.activeIndex = (window.ackReqMentionState.activeIndex + 1) % max;
        ackReqUpdateSuggestions();
      }
      return;
    }

    if (key === 'ArrowUp') {
      e.preventDefault();
      const max = (window.ackReqMentionState.results || []).length;
      if (max > 0) {
        window.ackReqMentionState.activeIndex = (window.ackReqMentionState.activeIndex - 1 + max) % max;
        ackReqUpdateSuggestions();
      }
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      const q = window.ackReqMentionState.query || '';
      if (q.length === 0) {
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
      } else {
        window.ackReqMentionState.query = q.slice(0, -1);
      }
      ackReqRenderMentionBox();
      ackReqUpdateSuggestions();
      return;
    }

    if (key === ' ') {
      e.preventDefault();
      if (!ackReqTrySelectActiveResult()) {
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
        ackReqRenderMentionBox();
      }
      return;
    }

    if (key.length === 1) {
      const ch = key;
      if (!/^[a-zA-Z0-9._-]$/.test(ch)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      window.ackReqMentionState.query = `${window.ackReqMentionState.query || ''}${ch}`;
      await ackReqEnsureUsersLoaded();
      ackReqRenderMentionBox();
      ackReqUpdateSuggestions();
      return;
    }
  });

  box.addEventListener('paste', (e) => {
    const roleSel = document.getElementById('ack-req-role');
    const isActive = roleSel && roleSel.value === 'custom';
    if (!isActive) return;
    e.preventDefault();
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('ack-req-custom-role-wrap');
    const suggest = ackReqGetSuggestBox();
    if (!wrap || !suggest || suggest.hidden) return;
    if (wrap.contains(e.target)) return;
    window.ackReqMentionState.mentionActive = false;
    window.ackReqMentionState.query = '';
    ackReqCloseSuggestions();
    ackReqRenderMentionBox();
  });
}

async function openAckRequirementModal(documentId) {
  window.ackRequirementContext = { documentId };
  const overlay = document.getElementById('ack-requirement-modal');
  if (!overlay) return;

  const roleSel = document.getElementById('ack-req-role');
  const customWrap = document.getElementById('ack-req-custom-role-wrap');
  const customInput = document.getElementById('ack-req-custom-role');
  const userSel = document.getElementById('ack-req-user');
  const dueInput = document.getElementById('ack-req-due-days');

  if (roleSel) roleSel.value = '';
  if (customInput) customInput.innerHTML = '';
  if (customWrap) customWrap.style.display = 'none';
  if (dueInput) dueInput.value = '7';
  if (userSel) userSel.innerHTML = '<option value="">Select a user</option>';
  window.ackReqMentionState.selected = [];
  window.ackReqMentionState.mentionActive = false;
  window.ackReqMentionState.query = '';
  ackReqCloseSuggestions();
  ackReqInitMentionInputOnce();
  ackReqRenderMentionBox();

  if (roleSel) {
    roleSel.onchange = () => {
      const v = roleSel.value;
      if (customWrap) customWrap.style.display = v === 'custom' ? 'block' : 'none';
      if (v !== 'custom') {
        window.ackReqMentionState.selected = [];
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
        if (customInput) customInput.innerHTML = '';
      }
      ackReqRenderMentionBox();
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const users = await res.json().catch(() => []);
      window.ackReqMentionState.users = Array.isArray(users) ? users : [];
      (users || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = String(u.id);
        opt.textContent = `${u.name}`;
        if (userSel) userSel.appendChild(opt);
      });
    }
  } catch {
  }

  overlay.classList.add('active');
}

function closeAckRequirementModal() {
  const overlay = document.getElementById('ack-requirement-modal');
  if (overlay) overlay.classList.remove('active');
}

async function submitAckRequirement() {
  const documentId = window.ackRequirementContext?.documentId;
  if (!documentId) return;
  const roleSel = document.getElementById('ack-req-role');
  const customInput = document.getElementById('ack-req-custom-role');
  const userSel = document.getElementById('ack-req-user');
  const dueInput = document.getElementById('ack-req-due-days');

  let role = (roleSel?.value || '').trim();
  const isCustom = role === 'custom';
  if (isCustom) role = '';
  const userIdRaw = (userSel?.value || '').trim();
  const individualUserId = userIdRaw ? parseInt(userIdRaw, 10) : null;
  const dueDays = dueInput?.value ? parseInt(dueInput.value, 10) : 7;
  try {
    const safeDue = isNaN(dueDays) ? 7 : dueDays;

    if (isCustom) {
      if (window.ackReqMentionState.mentionActive) {
        showToast('Please select a user from the list (press Enter) or clear the @search', 'error');
        return;
      }

      const selectedIds = new Set((window.ackReqMentionState.selected || []).map(u => u.id));
      if (individualUserId) selectedIds.add(individualUserId);
      const ids = Array.from(selectedIds).filter(n => typeof n === 'number' && !isNaN(n));
      if (ids.length === 0) {
        showToast('Please @mention at least one existing user', 'error');
        return;
      }

      for (const uid of ids) {
        const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/requirements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            required_role: null,
            individual_user_id: uid,
            due_days: safeDue
          })
        });
        if (!res.ok) throw new Error(await res.text());

        await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders?user_id=${encodeURIComponent(uid)}`, { method: 'POST' }).catch(() => null);
      }
    } else {
      const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          required_role: role || null,
          individual_user_id: individualUserId,
          due_days: safeDue
        })
      });
      if (!res.ok) throw new Error(await res.text());
    }

    closeAckRequirementModal();
    await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

async function sendAckReminders(documentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

async function sendAckReminder(documentId, userId) {
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
  } catch {
  }
}

function exportAckReport(documentId) {
  window.open(`${API_BASE_URL}/documents/${documentId}/acknowledgment/report`, '_blank');
}

window.ackConfirmContext = { documentId: null, title: '', revision: '' };
function openAckConfirmModal(documentId, title, revision) {
  window.ackConfirmContext = { documentId, title: title || '', revision: revision || '' };
  const titleEl = document.getElementById('ack-confirm-doc-title');
  const revEl = document.getElementById('ack-confirm-doc-rev');
  const checkbox = document.getElementById('ack-confirm-checkbox');
  if (titleEl) titleEl.textContent = title || '';
  if (revEl) revEl.textContent = revision || '';
  if (checkbox) checkbox.checked = false;
  const overlay = document.getElementById('ack-confirm-modal');
  if (overlay) overlay.classList.add('active');
}

function closeAckConfirmModal() {
  const overlay = document.getElementById('ack-confirm-modal');
  if (overlay) overlay.classList.remove('active');
}

async function submitAcknowledgment() {
  const checkbox = document.getElementById('ack-confirm-checkbox');
  if (!checkbox || !checkbox.checked) return;
  const documentId = window.ackConfirmContext?.documentId;
  if (!documentId) return;
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
    if (!res.ok) throw new Error(await res.text());
    closeAckConfirmModal();
    await refreshAckNavBadge();
    await loadMyDocuments();
    const ackTab = document.getElementById('document-tab-ack');
    if (ackTab && ackTab.style.display !== 'none') await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

window.ackRequirementContext = { documentId: null };
window.ackReqMentionState = {
  initialized: false,
  users: null,
  selected: [],
  mentionActive: false,
  query: '',
  results: [],
  activeIndex: 0
};

function ackReqGetMentionBox() {
  return document.getElementById('ack-req-custom-role');
}

function ackReqGetSuggestBox() {
  return document.getElementById('ack-req-custom-role-suggest');
}

function ackReqEnsureUsersLoaded() {
  if (Array.isArray(window.ackReqMentionState.users)) return Promise.resolve(window.ackReqMentionState.users);
  return fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' })
    .then(async res => {
      if (!res.ok) return [];
      const users = await res.json().catch(() => []);
      window.ackReqMentionState.users = Array.isArray(users) ? users : [];
      return window.ackReqMentionState.users;
    })
    .catch(() => []);
}

function ackReqRenderMentionBox() {
  const box = ackReqGetMentionBox();
  if (!box) return;
  box.innerHTML = '';
  (window.ackReqMentionState.selected || []).forEach(u => {
    const chip = document.createElement('span');
    chip.className = 'badge badge-blue';
    chip.setAttribute('data-user-id', String(u.id));
    chip.setAttribute('contenteditable', 'false');
    chip.textContent = u.name || u.email || `User ${u.id}`;
    chip.onclick = () => {
      window.ackReqMentionState.selected = (window.ackReqMentionState.selected || []).filter(x => x.id !== u.id);
      ackReqRenderMentionBox();
    };
    box.appendChild(chip);
    box.appendChild(document.createTextNode(' '));
  });
  if (window.ackReqMentionState.mentionActive) {
    box.appendChild(document.createTextNode(`@${window.ackReqMentionState.query || ''}`));
  } else {
    box.appendChild(document.createTextNode(''));
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
  }
}

function ackReqCloseSuggestions() {
  const suggest = ackReqGetSuggestBox();
  if (suggest) {
    suggest.hidden = true;
    suggest.innerHTML = '';
  }
  window.ackReqMentionState.results = [];
  window.ackReqMentionState.activeIndex = 0;
}

function ackReqUpdateSuggestions() {
  const suggest = ackReqGetSuggestBox();
  if (!suggest) return;
  if (!window.ackReqMentionState.mentionActive) {
    ackReqCloseSuggestions();
    return;
  }
  const q = (window.ackReqMentionState.query || '').trim().toLowerCase();
  const users = Array.isArray(window.ackReqMentionState.users) ? window.ackReqMentionState.users : [];
  const selectedIds = new Set((window.ackReqMentionState.selected || []).map(u => u.id));
  const matches = users
    .filter(u => !selectedIds.has(u.id))
    .filter(u => {
      if (!q) return true;
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .slice(0, 8);

  window.ackReqMentionState.results = matches;
  window.ackReqMentionState.activeIndex = 0;

  if (matches.length === 0) {
    suggest.hidden = true;
    suggest.innerHTML = '';
    return;
  }

  suggest.hidden = false;
  suggest.innerHTML = matches.map((u, idx) => {
    const label = `${escapeHtml(u.name || '')}${u.email ? ` (${escapeHtml(u.email)})` : ''}`;
    const active = idx === (window.ackReqMentionState.activeIndex || 0);
    return `<button type="button" class="btn btn-ghost" data-idx="${idx}" data-user-id="${u.id}" aria-selected="${active ? 'true' : 'false'}">${label}</button>`;
  }).join('');

  Array.from(suggest.querySelectorAll('button[data-user-id]')).forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-user-id') || '', 10);
      if (!isNaN(id)) ackReqSelectUserById(id);
    };
  });
}

function ackReqSelectUserById(userId) {
  const users = Array.isArray(window.ackReqMentionState.users) ? window.ackReqMentionState.users : [];
  const user = users.find(u => u.id === userId);
  if (!user) {
    showToast('User not found', 'error');
    return;
  }
  const exists = (window.ackReqMentionState.selected || []).some(u => u.id === userId);
  if (!exists) window.ackReqMentionState.selected = [...(window.ackReqMentionState.selected || []), user];
  window.ackReqMentionState.mentionActive = false;
  window.ackReqMentionState.query = '';
  ackReqCloseSuggestions();
  ackReqRenderMentionBox();
}

function ackReqTrySelectActiveResult() {
  const results = window.ackReqMentionState.results || [];
  const idx = window.ackReqMentionState.activeIndex || 0;
  const pick = results[idx] || results[0];
  if (!pick) {
    showToast('No matching user found', 'error');
    return false;
  }
  ackReqSelectUserById(pick.id);
  return true;
}

function ackReqInitMentionInputOnce() {
  if (window.ackReqMentionState.initialized) return;
  window.ackReqMentionState.initialized = true;
  const box = ackReqGetMentionBox();
  if (!box) return;

  box.addEventListener('keydown', async (e) => {
    const roleSel = document.getElementById('ack-req-role');
    const isActive = roleSel && roleSel.value === 'custom';
    if (!isActive) return;

    const key = e.key;
    const isMention = window.ackReqMentionState.mentionActive;

    if (!isMention) {
      if (key === '@') {
        e.preventDefault();
        window.ackReqMentionState.mentionActive = true;
        window.ackReqMentionState.query = '';
        await ackReqEnsureUsersLoaded();
        ackReqRenderMentionBox();
        ackReqUpdateSuggestions();
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        const selected = window.ackReqMentionState.selected || [];
        if (selected.length > 0) {
          window.ackReqMentionState.selected = selected.slice(0, -1);
          ackReqRenderMentionBox();
        }
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        return;
      }
      if (key.length === 1) {
        e.preventDefault();
        showToast('Type "@" to search and select users', 'error');
      }
      return;
    }

    if (key === 'Escape') {
      e.preventDefault();
      window.ackReqMentionState.mentionActive = false;
      window.ackReqMentionState.query = '';
      ackReqCloseSuggestions();
      ackReqRenderMentionBox();
      return;
    }

    if (key === 'Enter' || key === 'Tab') {
      e.preventDefault();
      ackReqTrySelectActiveResult();
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      const max = (window.ackReqMentionState.results || []).length;
      if (max > 0) {
        window.ackReqMentionState.activeIndex = (window.ackReqMentionState.activeIndex + 1) % max;
        ackReqUpdateSuggestions();
      }
      return;
    }

    if (key === 'ArrowUp') {
      e.preventDefault();
      const max = (window.ackReqMentionState.results || []).length;
      if (max > 0) {
        window.ackReqMentionState.activeIndex = (window.ackReqMentionState.activeIndex - 1 + max) % max;
        ackReqUpdateSuggestions();
      }
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      const q = window.ackReqMentionState.query || '';
      if (q.length === 0) {
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
      } else {
        window.ackReqMentionState.query = q.slice(0, -1);
      }
      ackReqRenderMentionBox();
      ackReqUpdateSuggestions();
      return;
    }

    if (key === ' ') {
      e.preventDefault();
      if (!ackReqTrySelectActiveResult()) {
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
        ackReqRenderMentionBox();
      }
      return;
    }

    if (key.length === 1) {
      const ch = key;
      if (!/^[a-zA-Z0-9._-]$/.test(ch)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      window.ackReqMentionState.query = `${window.ackReqMentionState.query || ''}${ch}`;
      await ackReqEnsureUsersLoaded();
      ackReqRenderMentionBox();
      ackReqUpdateSuggestions();
      return;
    }
  });

  box.addEventListener('paste', (e) => {
    const roleSel = document.getElementById('ack-req-role');
    const isActive = roleSel && roleSel.value === 'custom';
    if (!isActive) return;
    e.preventDefault();
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('ack-req-custom-role-wrap');
    const suggest = ackReqGetSuggestBox();
    if (!wrap || !suggest || suggest.hidden) return;
    if (wrap.contains(e.target)) return;
    window.ackReqMentionState.mentionActive = false;
    window.ackReqMentionState.query = '';
    ackReqCloseSuggestions();
    ackReqRenderMentionBox();
  });
}

async function openAckRequirementModal(documentId) {
  window.ackRequirementContext = { documentId };
  const overlay = document.getElementById('ack-requirement-modal');
  if (!overlay) return;

  const roleSel = document.getElementById('ack-req-role');
  const customWrap = document.getElementById('ack-req-custom-role-wrap');
  const customInput = document.getElementById('ack-req-custom-role');
  const userSel = document.getElementById('ack-req-user');
  const dueInput = document.getElementById('ack-req-due-days');

  if (roleSel) roleSel.value = '';
  if (customInput) customInput.innerHTML = '';
  if (customWrap) customWrap.style.display = 'none';
  if (dueInput) dueInput.value = '7';
  if (userSel) userSel.innerHTML = '<option value="">Select a user</option>';
  window.ackReqMentionState.selected = [];
  window.ackReqMentionState.mentionActive = false;
  window.ackReqMentionState.query = '';
  ackReqCloseSuggestions();
  ackReqInitMentionInputOnce();
  ackReqRenderMentionBox();

  if (roleSel) {
    roleSel.onchange = () => {
      const v = roleSel.value;
      if (customWrap) customWrap.style.display = v === 'custom' ? 'block' : 'none';
      if (v !== 'custom') {
        window.ackReqMentionState.selected = [];
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
        if (customInput) customInput.innerHTML = '';
      }
      ackReqRenderMentionBox();
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const users = await res.json().catch(() => []);
      window.ackReqMentionState.users = Array.isArray(users) ? users : [];
      (users || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = String(u.id);
        opt.textContent = `${u.name}`;
        if (userSel) userSel.appendChild(opt);
      });
    }
  } catch {
  }

  overlay.classList.add('active');
}

function closeAckRequirementModal() {
  const overlay = document.getElementById('ack-requirement-modal');
  if (overlay) overlay.classList.remove('active');
}

async function submitAckRequirement() {
  const documentId = window.ackRequirementContext?.documentId;
  if (!documentId) return;
  const roleSel = document.getElementById('ack-req-role');
  const customInput = document.getElementById('ack-req-custom-role');
  const userSel = document.getElementById('ack-req-user');
  const dueInput = document.getElementById('ack-req-due-days');

  let role = (roleSel?.value || '').trim();
  const isCustom = role === 'custom';
  if (isCustom) role = '';
  const userIdRaw = (userSel?.value || '').trim();
  const individualUserId = userIdRaw ? parseInt(userIdRaw, 10) : null;
  const dueDays = dueInput?.value ? parseInt(dueInput.value, 10) : 7;

  try {
    const safeDue = isNaN(dueDays) ? 7 : dueDays;

    if (isCustom) {
      if (window.ackReqMentionState.mentionActive) {
        showToast('Please select a user from the list (press Enter) or clear the @search', 'error');
        return;
      }

      const selectedIds = new Set((window.ackReqMentionState.selected || []).map(u => u.id));
      if (individualUserId) selectedIds.add(individualUserId);
      const ids = Array.from(selectedIds).filter(n => typeof n === 'number' && !isNaN(n));
      if (ids.length === 0) {
        showToast('Please @mention at least one existing user', 'error');
        return;
      }

      for (const uid of ids) {
        const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/requirements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            required_role: null,
            individual_user_id: uid,
            due_days: safeDue
          })
        });
        if (!res.ok) throw new Error(await res.text());

        await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders?user_id=${encodeURIComponent(uid)}`, { method: 'POST' }).catch(() => null);
      }
    } else {
      const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          required_role: role || null,
          individual_user_id: individualUserId,
          due_days: safeDue
        })
      });
      if (!res.ok) throw new Error(await res.text());
    }

    closeAckRequirementModal();
    await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

async function sendAckReminders(documentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

async function sendAckReminder(documentId, userId) {
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
  } catch {
  }
}
