function humanizeApprovalStatus(status) {
  const s = status ? String(status) : '';
  return s.replace(/_/g, ' ');
}

function badgeForApprovalStatus(status) {
  const s = status ? String(status) : '';
  if (s === 'approved') return 'green';
  if (s === 'rejected') return 'red';
  if (s === 'changes_requested') return 'orange';
  if (s === 'pending_approval' || s === 'pending') return 'yellow';
  return 'gray';
}

async function loadDocumentApproval(documentId) {
  const el = document.getElementById('document-approval-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading approval...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/approval-status?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    const approval = data?.approval || {};
    const steps = approval?.steps || [];
    const status = approval?.status || 'pending';
    const currentStepNumber = approval?.current_step_number;
    const currentStep = steps.find(s => s.step_number === currentStepNumber) || null;
    const permissions = data?.permissions || {};
    const canStart = !!permissions.can_start;
    const canApprove = !!permissions.can_approve;
    const currentUser = window.CURRENT_USER;
    const isAuthorized = !!currentUser && (currentUser.Role === 'Admin' || currentUser.Role === 'Quality Manager');
    const isUnlocked = (status === 'not_started' || status === 'rejected');
    const canManageSteps = isAuthorized && isUnlocked;
    const workflowLocked = !isUnlocked;
    const canShowActions = steps.length > 0 && canApprove && status !== 'not_started' && status !== 'approved' && status !== 'rejected';
    window.currentDocumentId = documentId;
    window.documentApprovalContext = { documentId, approval, steps, permissions, canManageSteps, isAuthorized, isUnlocked };

    el.innerHTML = `
      <div class="panel" style="margin:0;">
        <div class="panel-header">
          <div class="panel-title">Status</div>
        </div>
        <div style="padding: 12px 14px;">
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="badge badge-${badgeForApprovalStatus(status)}">${escapeHtml(humanizeApprovalStatus(status))}</span>
            <span style="color:var(--text-muted); font-size:13px;">
              ${status === 'not_started' ? 'Approval has not started.' : (status === 'approved' ? 'Approval workflow completed.' : 'Approval workflow in progress.')}
              ${currentStep ? ` Current step: ${escapeHtml(currentStep.step_name)}.` : ''}
            </span>
          </div>
        </div>
      </div>

      ${(status === 'not_started' && canStart) ? `
        <div class="panel" style="margin-top:14px;">
          <div class="panel-header">
            <div class="panel-title">Start Approval</div>
          </div>
          <div style="padding: 12px 14px; display:flex; justify-content:flex-end;">
            <button type="button" class="btn btn-primary" onclick="startDocumentApproval(${documentId})">Start</button>
          </div>
        </div>
      ` : ''}

      <div class="panel" style="margin-top:14px;">
        <div class="panel-header">
          <div class="panel-title" style="display:flex; align-items:center; gap:8px;">
            ${workflowLocked ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` : ''}
            Approval Process
          </div>
        </div>
        <div style="padding: 12px 14px;">
          ${isAuthorized ? `
            <div class="workflow-management-bar">
              ${workflowLocked ? `
                <div class="workflow-locked-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Workflow is locked while approval is in progress. Steps can only be edited when status is Draft or Rejected.
                </div>
              ` : `
                <div class="workflow-actions">
                  <span class="workflow-hint">Drag steps to reorder</span>
                  <button type="button" class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="openAddStepModal()">+ Add Step</button>
                </div>
              `}
            </div>
          ` : ''}

          ${steps.length === 0 ? '<div style="color:var(--text-muted); font-size:13px;">No workflow started for this document.</div>' : `
            <div class="approval-steps-container" id="steps-container">
              ${steps.map(s => `
                <div class="approval-step ${workflowLocked ? 'locked' : ''}" data-step-id="${escapeHtml(s.id)}" style="${s.step_number === currentStepNumber ? 'border-color: rgba(59, 139, 255, 0.45);' : ''}">
                  <div class="step-left">
                    ${canManageSteps ? `<div class="drag-handle" title="Drag to reorder">⠿</div>` : ''}
                    <div class="step-number">${escapeHtml(s.step_number)}</div>
                  </div>

                  <div class="step-content">
                    <strong>${escapeHtml(s.step_name)}</strong>
                    <span>Role: ${escapeHtml((s.required_role || ''))}</span>
                    ${(s.required_user_name || s.required_user_id) ? `<span>Assigned to: ${escapeHtml(s.required_user_name || ('User #' + s.required_user_id))}</span>` : ''}
                    ${s.comment ? `<span>Comment: ${escapeHtml(s.comment)}</span>` : ''}
                  </div>

                  <div style="display:flex; gap:10px; align-items:center; flex-shrink:0;">
                    <span class="badge badge-${badgeForApprovalStatus(s.status || 'pending')}">${escapeHtml(humanizeApprovalStatus(s.status || 'pending'))}</span>
                    ${canManageSteps ? `
                      <div class="step-management-actions">
                        <button type="button" class="btn-icon btn-edit" onclick="openEditStepModal('${escapeHtml(s.id)}')" title="Edit Step"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                        <button type="button" class="btn-icon btn-delete" onclick="confirmDeleteStep('${escapeHtml(s.id)}')" title="Delete Step"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      ${canShowActions ? `
        <div class="panel" style="margin-top:14px;">
          <div class="panel-header">
            <div class="panel-title">Action</div>
          </div>
          <div style="padding: 12px 14px;">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Comment (optional)</label>
              <textarea id="document-approval-comment" class="form-input" rows="3" placeholder="Add a comment..."></textarea>
            </div>
            <div style="display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost" onclick="requestDocumentChanges(${documentId})">Request Changes</button>
              <button type="button" class="btn btn-ghost" onclick="rejectDocumentApproval(${documentId})" style="border-color: rgba(255,107,53,0.35);">Reject</button>
              <button type="button" class="btn btn-primary" onclick="approveDocumentStep(${documentId})">Approve</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    if (canManageSteps) initDragToReorder();
  } catch (e) {
    el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading approval.</div>';
  }
}

function getDocumentApprovalComment() {
  const el = document.getElementById('document-approval-comment');
  const value = el?.value != null ? String(el.value).trim() : '';
  return value.length ? value : null;
}

async function startDocumentApproval(documentId) {
  const el = document.getElementById('document-approval-content');
  if (el) el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Starting approval...</div>';
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/approval-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userId: window.CURRENT_USER?.Id || 0, comment: null })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentApproval(documentId);
  } catch (e) {
    if (el) el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error starting approval.</div>';
  }
}

async function approveDocumentStep(documentId) {
  const comment = getDocumentApprovalComment();
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/approve-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userId: window.CURRENT_USER?.Id || 0, comment })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentApproval(documentId);
  } catch (e) {
    const el = document.getElementById('document-approval-content');
    if (el) el.insertAdjacentHTML('beforeend', '<div style="margin-top:12px; text-align:center; padding:10px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error approving step.</div>');
  }
}

async function requestDocumentChanges(documentId) {
  const comment = getDocumentApprovalComment();
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/request-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userId: window.CURRENT_USER?.Id || 0, comment })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentApproval(documentId);
  } catch (e) {
    const el = document.getElementById('document-approval-content');
    if (el) el.insertAdjacentHTML('beforeend', '<div style="margin-top:12px; text-align:center; padding:10px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error requesting changes.</div>');
  }
}

async function rejectDocumentApproval(documentId) {
  const comment = getDocumentApprovalComment();
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ userId: window.CURRENT_USER?.Id || 0, comment })
    });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentApproval(documentId);
  } catch (e) {
    const el = document.getElementById('document-approval-content');
    if (el) el.insertAdjacentHTML('beforeend', '<div style="margin-top:12px; text-align:center; padding:10px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error rejecting document.</div>');
  }
}

function setButtonLoading(buttonId, isLoading, loadingText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent || '';
    btn.disabled = true;
    btn.style.opacity = '0.75';
    btn.textContent = loadingText || 'Loading...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    if (btn.dataset.originalText != null) btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
}

async function safeReadJson(res) {
  try { return await res.json(); } catch { return null; }
}

function handleAddStepRoleChange(value) {
  const group = document.getElementById('custom-role-group');
  if (!group) return;
  group.style.display = value === 'custom' ? 'block' : 'none';
  const warning = document.getElementById('workflow-role-warning');
  if (warning) warning.style.display = (value === 'Safety Manager' || value === 'Operations Manager') ? 'block' : 'none';
  if (value !== 'custom') {
    const input = document.getElementById('custom-role-input');
    if (input) input.value = '';
  }
}

function handleEditStepRoleChange(value) {
  const group = document.getElementById('edit-custom-role-group');
  if (!group) return;
  group.style.display = value === 'custom' ? 'block' : 'none';
  const warning = document.getElementById('edit-workflow-role-warning');
  if (warning) warning.style.display = (value === 'Safety Manager' || value === 'Operations Manager') ? 'block' : 'none';
  if (value !== 'custom') {
    const input = document.getElementById('edit-custom-role-input');
    if (input) input.value = '';
  }
}

function openAddStepModal() {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;
  const modal = document.getElementById('add-step-modal');
  if (!modal) return;

  const name = document.getElementById('step-name-input');
  const role = document.getElementById('step-role-select');
  const custom = document.getElementById('custom-role-input');
  const pos = document.getElementById('step-position-select');

  if (name) name.value = '';
  if (role) role.value = '';
  if (custom) custom.value = '';
  handleAddStepRoleChange('');

  if (pos) {
    pos.innerHTML = '<option value="end">Add at the end (last step)</option><option value="beginning">Add at the beginning (first step)</option>';
    (ctx.steps || []).forEach(s => {
      const opt = document.createElement('option');
      opt.value = `after_${s.step_number}`;
      opt.textContent = `After Step ${s.step_number}: ${s.step_name || ''}`.trim();
      pos.appendChild(opt);
    });
  }

  populateWorkflowUsers('step-user-select', '');
  modal.classList.add('active');
}

function closeAddStepModal() {
  const modal = document.getElementById('add-step-modal');
  if (modal) modal.classList.remove('active');
  const name = document.getElementById('step-name-input');
  const role = document.getElementById('step-role-select');
  const custom = document.getElementById('custom-role-input');
  const user = document.getElementById('step-user-select');
  const pos = document.getElementById('step-position-select');
  if (name) name.value = '';
  if (role) role.value = '';
  if (custom) custom.value = '';
  if (user) user.value = '';
  if (pos) pos.value = 'end';
  handleAddStepRoleChange('');
  setButtonLoading('add-step-submit', false);
}

async function submitAddStep() {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;

  const stepName = (document.getElementById('step-name-input')?.value || '').trim();
  const role = document.getElementById('step-role-select')?.value || '';
  const customRole = (document.getElementById('custom-role-input')?.value || '').trim();
  const userId = document.getElementById('step-user-select')?.value || '';
  const position = document.getElementById('step-position-select')?.value || 'end';

  if (!stepName) { showToast('Step name is required', 'error'); return; }
  if (!role) { showToast('Required role is required', 'error'); return; }
  if (role === 'custom' && !customRole) { showToast('Please enter custom role name', 'error'); return; }

  const finalRole = role === 'custom' ? customRole : role;
  let insertAfterStep = null;
  if (position === 'beginning') insertAfterStep = 0;
  else if (position === 'end') insertAfterStep = null;
  else if (position.startsWith('after_')) {
    const n = parseInt(position.replace('after_', ''), 10);
    insertAfterStep = isNaN(n) ? null : n;
  }

  try {
    setButtonLoading('add-step-submit', true, 'Adding...');
    const response = await fetch(`${API_BASE_URL}/documents/${ctx.documentId}/approval/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        step_name: stepName,
        required_role: finalRole,
        required_user_id: userId ? parseInt(userId, 10) : null,
        insert_after_step: insertAfterStep
      })
    });
    if (!response.ok) {
      const err = await safeReadJson(response);
      showToast(err?.error || 'Failed to add step', 'error');
      return;
    }
    showToast('Step added successfully', 'success');
    closeAddStepModal();
    await loadDocumentApproval(ctx.documentId);
  } catch {
    showToast('Failed to add step', 'error');
  } finally {
    setButtonLoading('add-step-submit', false);
  }
}

async function openEditStepModal(stepId) {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;

  const modal = document.getElementById('edit-step-modal');
  if (!modal) return;
  modal.classList.add('active');

  try {
    setButtonLoading('edit-step-submit', true, 'Loading...');
    const response = await fetch(`${API_BASE_URL}/documents/${ctx.documentId}/approval/steps/${encodeURIComponent(stepId)}?_=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      const err = await safeReadJson(response);
      showToast(err?.error || 'Failed to load step data', 'error');
      closeEditStepModal();
      return;
    }
    const step = await response.json();

    const idEl = document.getElementById('edit-step-id');
    const nameEl = document.getElementById('edit-step-name');
    const roleEl = document.getElementById('edit-step-role');
    const customEl = document.getElementById('edit-custom-role-input');

    if (idEl) idEl.value = step.id;
    if (nameEl) nameEl.value = step.step_name || '';

    const roleValue = (step.required_role || '').toString();
    const knownRoles = ['Admin','Quality Manager','Document Owner','Department Head','Safety Manager','Operations Manager'];
    if (roleEl) {
      if (knownRoles.includes(roleValue)) {
        roleEl.value = roleValue;
        handleEditStepRoleChange(roleValue);
        if (customEl) customEl.value = '';
      } else {
        roleEl.value = 'custom';
        handleEditStepRoleChange('custom');
        if (customEl) customEl.value = roleValue;
      }
    }

    await populateWorkflowUsers('edit-step-user', step.required_user_id ? String(step.required_user_id) : '');
  } catch {
    showToast('Failed to load step data', 'error');
    closeEditStepModal();
  } finally {
    setButtonLoading('edit-step-submit', false);
  }
}

function closeEditStepModal() {
  const modal = document.getElementById('edit-step-modal');
  if (modal) modal.classList.remove('active');
  const idEl = document.getElementById('edit-step-id');
  const nameEl = document.getElementById('edit-step-name');
  const roleEl = document.getElementById('edit-step-role');
  const customEl = document.getElementById('edit-custom-role-input');
  const userEl = document.getElementById('edit-step-user');
  if (idEl) idEl.value = '';
  if (nameEl) nameEl.value = '';
  if (roleEl) roleEl.value = '';
  if (customEl) customEl.value = '';
  if (userEl) userEl.value = '';
  handleEditStepRoleChange('');
  setButtonLoading('edit-step-submit', false);
}

async function submitEditStep() {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;

  const stepId = document.getElementById('edit-step-id')?.value || '';
  const stepName = (document.getElementById('edit-step-name')?.value || '').trim();
  const role = document.getElementById('edit-step-role')?.value || '';
  const customRole = (document.getElementById('edit-custom-role-input')?.value || '').trim();
  const userId = document.getElementById('edit-step-user')?.value || '';

  if (!stepName || !role) { showToast('Step name and role are required', 'error'); return; }
  if (role === 'custom' && !customRole) { showToast('Please enter custom role name', 'error'); return; }
  const finalRole = role === 'custom' ? customRole : role;

  try {
    setButtonLoading('edit-step-submit', true, 'Saving...');
    const response = await fetch(`${API_BASE_URL}/documents/${ctx.documentId}/approval/steps/${encodeURIComponent(stepId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        step_name: stepName,
        required_role: finalRole,
        required_user_id: userId ? parseInt(userId, 10) : null
      })
    });
    if (!response.ok) {
      const err = await safeReadJson(response);
      showToast(err?.error || 'Failed to update step', 'error');
      return;
    }
    showToast('Step updated successfully', 'success');
    closeEditStepModal();
    await loadDocumentApproval(ctx.documentId);
  } catch {
    showToast('Failed to update step', 'error');
  } finally {
    setButtonLoading('edit-step-submit', false);
  }
}

let stepToDelete = null;

function confirmDeleteStep(stepId) {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;
  const step = (ctx.steps || []).find(s => String(s.id) === String(stepId));
  if (!step) { showToast('Step not found', 'error'); return; }

  stepToDelete = stepId;
  const nameEl = document.getElementById('delete-step-name');
  const roleEl = document.getElementById('delete-step-role');
  if (nameEl) nameEl.textContent = step.step_name || '';
  if (roleEl) roleEl.textContent = `Role: ${step.required_role || ''}`;

  const modal = document.getElementById('delete-step-confirm');
  if (modal) modal.classList.add('active');
}

function closeDeleteConfirm() {
  const modal = document.getElementById('delete-step-confirm');
  if (modal) modal.classList.remove('active');
  stepToDelete = null;
  setButtonLoading('delete-step-submit', false);
}

async function submitDeleteStep() {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;
  if (!stepToDelete) return;

  try {
    setButtonLoading('delete-step-submit', true, 'Deleting...');
    const response = await fetch(`${API_BASE_URL}/documents/${ctx.documentId}/approval/steps/${encodeURIComponent(stepToDelete)}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      const err = await safeReadJson(response);
      showToast(err?.error || 'Failed to delete step', 'error');
      return;
    }
    showToast('Step deleted. Remaining steps renumbered.', 'success');
    closeDeleteConfirm();
    await loadDocumentApproval(ctx.documentId);
  } catch {
    showToast('Failed to delete step', 'error');
  } finally {
    setButtonLoading('delete-step-submit', false);
  }
}

function initDragToReorder() {
  const ctx = window.documentApprovalContext;
  if (!ctx?.canManageSteps) return;
  const stepsContainer = document.getElementById('steps-container');
  if (!stepsContainer) return;
  if (typeof Sortable === 'undefined') return;

  if (window.approvalSortable && window.approvalSortable.destroy) {
    window.approvalSortable.destroy();
  }

  window.approvalSortable = new Sortable(stepsContainer, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'step-ghost',
    onEnd: async function() {
      const stepIds = Array.from(stepsContainer.querySelectorAll('.approval-step'))
        .map(el => el.dataset.stepId)
        .filter(Boolean);
      try {
        const res = await fetch(`${API_BASE_URL}/documents/${ctx.documentId}/approval/steps/reorder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ step_ids: stepIds })
        });
        if (!res.ok) {
          const err = await safeReadJson(res);
          showToast(err?.error || 'Failed to reorder steps', 'error');
        } else {
          showToast('Steps reordered', 'success');
        }
      } catch {
        showToast('Failed to reorder steps', 'error');
      } finally {
        await loadDocumentApproval(ctx.documentId);
      }
    }
  });
}
