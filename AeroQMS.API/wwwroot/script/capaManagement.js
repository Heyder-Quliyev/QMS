function capaManagementDeps() {
  return window.__capaManagementDeps || {};
}

function capaApiBaseUrl() {
  return capaManagementDeps().API_BASE_URL || '/api';
}

function capaGetStatusBadge(status) {
  const fn = capaManagementDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function capaGetPriorityBadge(priority) {
  const fn = capaManagementDeps().getPriorityBadge;
  return typeof fn === 'function' ? fn(priority) : 'gray';
}

function capaShowToast(message, type = 'info') {
  const fn = capaManagementDeps().showToast;
  if (typeof fn === 'function') return fn(message, type);
  console.log(`[Toast] ${type}: ${message}`);
}

function capaEscapeHtml(value) {
  const fn = capaManagementDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function capaFormatTimeAgo(value) {
  const fn = capaManagementDeps().formatTimeAgo;
  return typeof fn === 'function' ? fn(value) : '';
}

function capaFormatAbsoluteTimestamp(value) {
  const fn = capaManagementDeps().formatAbsoluteTimestamp;
  return typeof fn === 'function' ? fn(value) : '';
}

function capaSetActiveTabButton(clickedButton) {
  const fn = capaManagementDeps().setActiveTabButton;
  if (typeof fn === 'function') return fn(clickedButton);
}

function capaCloseModal() {
  const fn = capaManagementDeps().closeModal;
  if (typeof fn === 'function') return fn();
}

function capaShowPage(id, el) {
  const fn = capaManagementDeps().showPage;
  if (typeof fn === 'function') return fn(id, el);
}

function capaGetNcrById(id) {
  const fn = capaManagementDeps().getNcrById;
  return typeof fn === 'function' ? fn(id) : null;
}

let allCapas = [];
let currentNcrIdForCapa = null;
let currentCapaWizardStep = 1;
let currentCapaIdForVerification = null;
const capaHistoryCache = {};
const capaHistoryUi = {};

window.currentCapaWizardStep = currentCapaWizardStep;

function syncCurrentCapaWizardStep() {
  window.currentCapaWizardStep = currentCapaWizardStep;
}

async function openCapaPage(ncrId) {
  currentNcrIdForCapa = ncrId;
  const ncr = capaGetNcrById(ncrId);
  document.getElementById('capa-panel-title').textContent = ncr ? `CAPA Actions for ${ncr.ncrNumber}` : 'CAPA Actions';
  await capaShowPage('capa');
}

async function fetchCapas() {
  const res = await fetch(`${capaApiBaseUrl()}/capa`);
  allCapas = await res.json();
  filterCapas();
}

function filterCapas() {
  const term = document.getElementById('capa-search').value.toLowerCase();
  let filtered = allCapas;

  if (currentNcrIdForCapa) {
    filtered = filtered.filter(c => c.ncrId === currentNcrIdForCapa);
  }

  filtered = filtered.filter(c =>
    c.title.toLowerCase().includes(term) ||
    c.description.toLowerCase().includes(term) ||
    c.responsiblePersonName.toLowerCase().includes(term)
  );

  renderCapaTable(filtered);
}

function renderCapaTable(capas) {
  const tbody = document.getElementById('capa-table-body');
  tbody.innerHTML = capas.map(c => {
    const status = (c.status || '').toLowerCase().replace(' ', '_');
    const isPending = status === 'pending_verification';

    return `
    <tr>
      <td>${c.title}</td>
      <td><span class="badge badge-blue">${c.actionType}</span></td>
      <td>
        <div style="font-size:12px;font-weight:600;">${c.responsiblePersonName}</div>
        <div style="font-size:10px;color:var(--text-muted);">${c.responsiblePersonEmail}</div>
      </td>
      <td>${new Date(c.dueDate).toLocaleDateString()}</td>
      <td><span class="badge badge-${capaGetStatusBadge(c.status)}">${c.status.replace('_', ' ')}</span></td>
      <td><span class="badge badge-${capaGetPriorityBadge(c.priority)}">${c.priority}</span></td>
      <td>
        <div class="actions-cell">
          ${isPending ? `<button class="btn-icon" onclick="openVerificationModal('${c.id}')" title="Verify Action" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.2);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
          <button class="btn-icon" onclick="viewCapa('${c.id}')" title="Info"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>
          <button class="btn-icon edit" onclick="editCapa('${c.id}')" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon delete" onclick="deleteCapa('${c.id}')" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function buildCapaForm() {
  currentCapaWizardStep = 1;
  syncCurrentCapaWizardStep();
  const title = document.getElementById('modal-title');
  const fields = document.getElementById('form-fields');
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (title) title.textContent = 'New CAPA Action - Step 1/4';
  if (saveBtn) saveBtn.style.display = 'none';
  if (!fields) return;

  fields.innerHTML = `
      <input type="hidden" name="ncrId" value="${currentNcrIdForCapa || ''}">
      
      <div class="tabs-nav" id="capa-wizard-tabs">
        <button type="button" class="tab-btn active" data-step="1" onclick="switchCapaWizard(1)">1. NCR Description</button>
        <button type="button" class="tab-btn" data-step="2" onclick="switchCapaWizard(2)">2. Root Cause</button>
        <button type="button" class="tab-btn" data-step="3" onclick="switchCapaWizard(3)">3. Action Plan</button>
        <button type="button" class="tab-btn" data-step="4" onclick="switchCapaWizard(4)">4. Review & Submit</button>
      </div>
      
      <div id="capa-wizard-step-1">
        <div class="info-grid" style="margin-bottom: 20px;">
          <div class="info-item"><span class="info-label">NCR Reference</span><input type="text" name="ncrReference" class="form-input" placeholder="NCR-2026-0001"></div>
          <div class="info-item"><span class="info-label">NCR Title</span><input type="text" name="ncrTitle" class="form-input" placeholder="Enter NCR title"></div>
        </div>
        <div class="form-group">
          <label class="form-label">NCR Description</label>
          <textarea name="ncrDescription" class="form-input" rows="4" placeholder="Describe the non-conformance in detail..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Date of Occurrence</label><input type="date" name="occurrenceDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="form-group"><label class="form-label">Location / Department</label><input type="text" name="location" class="form-input" placeholder="e.g., Hangar 3, Maintenance"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Reported By (Name)</label><input type="text" name="reportedByName" class="form-input" placeholder="John Doe"></div>
          <div class="form-group"><label class="form-label">Reported By (Email)</label><input type="email" name="reportedByEmail" class="form-input" placeholder="john@example.com"></div>
        </div>
        <div class="form-group"><label class="form-label">Attach Evidence</label><input type="file" name="evidenceFile" class="form-input" multiple></div>
      </div>
      
      <div id="capa-wizard-step-2" style="display:none;">
        <div class="form-group">
          <label class="form-label">Root Cause Analysis</label>
          <textarea name="rootCause" class="form-input" rows="5" placeholder="Use 5 Whys or Fishbone method to identify root cause..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Contributing Factors</label>
          <textarea name="contributingFactors" class="form-input" rows="3" placeholder="List any contributing factors..."></textarea>
        </div>
      </div>
      
      <div id="capa-wizard-step-3" style="display:none;">
        <div class="form-group"><label class="form-label">Action Title</label><input type="text" name="title" class="form-input" required></div>
        <div class="form-group">
          <label class="form-label">Action Type</label>
          <select name="actionType" class="form-input">
            <option value="corrective">Corrective (Fix the issue)</option>
            <option value="preventive">Preventive (Prevent recurrence)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Action Description</label>
          <textarea name="description" class="form-input" rows="3" required placeholder="Describe the corrective/preventive action..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Responsible Person ID</label><input type="number" name="responsiblePersonId" class="form-input" required></div>
          <div class="form-group"><label class="form-label">Responsible Name</label><input type="text" name="responsiblePersonName" class="form-input"></div>
        </div>
        <div class="form-group"><label class="form-label">Responsible Email</label><input type="email" name="responsiblePersonEmail" class="form-input"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Due Date</label><input type="date" name="dueDate" class="form-input" required></div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-input">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Initial Status</label>
          <select name="status" class="form-input">
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>
      </div>
      
      <div id="capa-wizard-step-4" style="display:none;">
        <div class="info-grid" style="margin-bottom: 20px;">
          <div class="info-item" style="grid-column:span 2;">
            <span class="info-label">Review all information before submitting</span>
            <span class="info-value" style="color: var(--text-muted); font-size: 13px;">Please verify that all details are correct.</span>
          </div>
        </div>
        <div id="capa-wizard-review" style="padding: 20px; background: rgba(255,255,255,0.02); border-radius: 8px; border:1px solid var(--border);">
          <p style="color: var(--text-muted); text-align: center;">Complete previous steps to see the summary here.</p>
        </div>
      </div>
      
      <div style="display:flex; justify-content:space-between; margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
        <button type="button" class="btn btn-ghost" id="capa-wizard-prev" onclick="switchCapaWizard(currentCapaWizardStep - 1)" style="display:none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Previous
        </button>
        <button type="button" class="btn btn-primary" id="capa-wizard-next" onclick="switchCapaWizard(currentCapaWizardStep + 1)">
          Next
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;

  document.getElementById('modal-overlay').classList.add('active');
}

function switchCapaWizard(step) {
  if (step < 1 || step > 4) return;

  currentCapaWizardStep = step;
  syncCurrentCapaWizardStep();

  document.querySelectorAll('#capa-wizard-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.dataset.step, 10) === step) {
      btn.classList.add('active');
    }
  });

  for (let i = 1; i <= 4; i++) {
    const stepDiv = document.getElementById(`capa-wizard-step-${i}`);
    if (stepDiv) {
      stepDiv.style.display = i === step ? 'block' : 'none';
    }
  }

  const prevBtn = document.getElementById('capa-wizard-prev');
  const nextBtn = document.getElementById('capa-wizard-next');
  const title = document.getElementById('modal-title');

  if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
  if (nextBtn) {
    if (step === 4) {
      nextBtn.textContent = 'Submit CAPA';
      nextBtn.onclick = submitCapaWizard;
      nextBtn.innerHTML = 'Submit CAPA';
    } else {
      nextBtn.innerHTML = 'Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      nextBtn.onclick = () => switchCapaWizard(step + 1);
    }
  }
  if (title) title.textContent = `New CAPA Action - Step ${step}/4`;

  if (step === 4) {
    updateCapaWizardReview();
  }
}

function updateCapaWizardReview() {
  const form = document.getElementById('record-form');
  const reviewDiv = document.getElementById('capa-wizard-review');
  if (!form || !reviewDiv) return;

  const formData = new FormData(form);
  reviewDiv.innerHTML = `
    <div class="info-grid">
      <div class="info-item"><span class="info-label">NCR Reference</span><span class="info-value">${formData.get('ncrReference') || '-'}</span></div>
      <div class="info-item"><span class="info-label">NCR Title</span><span class="info-value">${formData.get('ncrTitle') || '-'}</span></div>
      <div class="info-item" style="grid-column:span 2;"><span class="info-label">NCR Description</span><span class="info-value">${formData.get('ncrDescription') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Date of Occurrence</span><span class="info-value">${formData.get('occurrenceDate') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Location</span><span class="info-value">${formData.get('location') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Reported By</span><span class="info-value">${formData.get('reportedByName') || '-'}</span></div>
      <div class="info-item" style="grid-column:span 2;"><span class="info-label">Root Cause</span><span class="info-value">${formData.get('rootCause') || '-'}</span></div>
      <div class="info-item" style="grid-column:span 2;"><span class="info-label">Contributing Factors</span><span class="info-value">${formData.get('contributingFactors') || '-'}</span></div>
      <div class="info-item" style="grid-column:span 2;"><span class="info-label">Action Title</span><span class="info-value">${formData.get('title') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Action Type</span><span class="badge badge-blue">${formData.get('actionType') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Priority</span><span class="badge badge-${capaGetPriorityBadge(formData.get('priority') || 'medium')}">${formData.get('priority') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Responsible Person</span><span class="info-value">${formData.get('responsiblePersonName') || '-'}</span></div>
      <div class="info-item"><span class="info-label">Due Date</span><span class="info-value">${formData.get('dueDate') || '-'}</span></div>
    </div>
  `;
}

function normalizeCapaFormData(data) {
  data.responsiblePersonId = (data.responsiblePersonId && data.responsiblePersonId !== '') ? parseInt(data.responsiblePersonId, 10) : 0;
  if (data.ncrId && data.ncrId !== '') {
    data.ncrId = parseInt(data.ncrId, 10);
  } else {
    delete data.ncrId;
  }
  return data;
}

async function submitCapaWizard() {
  const form = document.getElementById('record-form');
  if (!form) return;

  const formData = new FormData(form);
  const capaId = document.getElementById('form-id').value;
  const isEdit = capaId && capaId.trim() !== '';
  const newId = crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000000';

  const capaData = {
    Id: isEdit ? capaId : newId,
    id: isEdit ? capaId : newId,
    Title: formData.get('title'),
    title: formData.get('title'),
    ActionType: formData.get('actionType'),
    actionType: formData.get('actionType'),
    Action: formData.get('title'),
    action: formData.get('title'),
    Description: formData.get('description'),
    description: formData.get('description'),
    ResponsiblePersonId: parseInt(formData.get('responsiblePersonId'), 10) || 0,
    responsiblePersonId: parseInt(formData.get('responsiblePersonId'), 10) || 0,
    ResponsiblePersonName: formData.get('responsiblePersonName') || '',
    responsiblePersonName: formData.get('responsiblePersonName') || '',
    ResponsiblePersonEmail: formData.get('responsiblePersonEmail') || '',
    responsiblePersonEmail: formData.get('responsiblePersonEmail') || '',
    DueDate: formData.get('dueDate') ? new Date(formData.get('dueDate')).toISOString() : new Date().toISOString(),
    dueDate: formData.get('dueDate') ? new Date(formData.get('dueDate')).toISOString() : new Date().toISOString(),
    Priority: formData.get('priority') || 'medium',
    priority: formData.get('priority') || 'medium',
    Status: formData.get('status') || 'not_started',
    status: formData.get('status') || 'not_started',
    NCRId: formData.get('ncrId') ? parseInt(formData.get('ncrId'), 10) : null,
    ncrId: formData.get('ncrId') ? parseInt(formData.get('ncrId'), 10) : null,
    CreatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    AssignedDate: new Date().toISOString(),
    assignedDate: new Date().toISOString(),
    NCRReference: formData.get('ncrReference'),
    ncrReference: formData.get('ncrReference'),
    NCRTitle: formData.get('ncrTitle'),
    ncrTitle: formData.get('ncrTitle'),
    NCRDescription: formData.get('ncrDescription'),
    ncrDescription: formData.get('ncrDescription'),
    OccurrenceDate: formData.get('occurrenceDate') ? new Date(formData.get('occurrenceDate')).toISOString() : null,
    occurrenceDate: formData.get('occurrenceDate') ? new Date(formData.get('occurrenceDate')).toISOString() : null,
    Location: formData.get('location'),
    location: formData.get('location'),
    ReportedByName: formData.get('reportedByName'),
    reportedByName: formData.get('reportedByName'),
    ReportedByEmail: formData.get('reportedByEmail'),
    reportedByEmail: formData.get('reportedByEmail'),
    RootCause: formData.get('rootCause'),
    rootCause: formData.get('rootCause'),
    ContributingFactors: formData.get('contributingFactors'),
    contributingFactors: formData.get('contributingFactors')
  };

  console.log('Is edit:', isEdit);
  console.log('Sending CAPA data:', capaData);

  try {
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `${capaApiBaseUrl()}/capa/${capaId}` : `${capaApiBaseUrl()}/capa`;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capaData)
    });

    console.log('Response status:', res.status);

    if (res.ok) {
      capaShowToast(`CAPA Action ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
      capaCloseModal();
      fetchCapas();
    } else {
      const errText = await res.text();
      console.error('Error response:', errText);
      try {
        const errJson = JSON.parse(errText);
        alert('Error ' + (isEdit ? 'updating' : 'creating') + ' CAPA: ' + JSON.stringify(errJson, null, 2));
      } catch (e) {
        alert('Error ' + (isEdit ? 'updating' : 'creating') + ' CAPA: ' + errText);
      }
    }
  } catch (err) {
    console.error('Error:', err);
    alert('Connection error: ' + err.message);
  }
}

async function viewCapa(id) {
  const c = await (await fetch(`${capaApiBaseUrl()}/capa/${id}`)).json();
  document.getElementById('modal-title').textContent = 'CAPA Action Details';

  document.getElementById('form-fields').innerHTML = `
    <div class="tabs-nav">
      <button type="button" class="tab-btn active" onclick="switchCapaTab(event, 'info', '${c.id || c.Id}')">Info</button>
      <button type="button" class="tab-btn" onclick="switchCapaTab(event, 'activity', '${c.id || c.Id}')">Activity</button>
      <button type="button" class="tab-btn" onclick="switchCapaTab(event, 'attachments', '${c.id || c.Id}')">Attachments</button>
      <button type="button" class="tab-btn" onclick="switchCapaTab(event, 'history', '${c.id || c.Id}')">History</button>
    </div>
    
    <div id="capa-tab-info">
      <div class="info-grid">
        <div class="info-item" style="grid-column:span 2;"><span class="info-label">Title</span><span class="info-value">${c.title || c.Title || '-'}</span></div>
        <div class="info-item"><span class="info-label">Type</span><span class="badge badge-blue">${c.actionType || c.ActionType || '-'}</span></div>
        <div class="info-item"><span class="info-label">Status</span><span class="badge badge-${capaGetStatusBadge(c.status || c.Status || 'not_started')}">${(c.status || c.Status || 'not_started').replace('_', ' ')}</span></div>
        <div class="info-item" style="grid-column:span 2;"><span class="info-label">Description</span><span class="info-value">${c.description || c.Description || '-'}</span></div>
        
        ${(c.ncrReference || c.NCRReference) ? `<div class="info-item"><span class="info-label">NCR Reference</span><span class="info-value">${c.ncrReference || c.NCRReference}</span></div>` : ''}
        ${(c.ncrTitle || c.NCRTitle) ? `<div class="info-item"><span class="info-label">NCR Title</span><span class="info-value">${c.ncrTitle || c.NCRTitle}</span></div>` : ''}
        ${(c.ncrDescription || c.NCRDescription) ? `<div class="info-item" style="grid-column:span 2;"><span class="info-label">NCR Description</span><span class="info-value">${c.ncrDescription || c.NCRDescription}</span></div>` : ''}
        ${(c.occurrenceDate || c.OccurrenceDate) ? `<div class="info-item"><span class="info-label">Occurrence Date</span><span class="info-value">${new Date(c.occurrenceDate || c.OccurrenceDate).toLocaleDateString()}</span></div>` : ''}
        ${(c.location || c.Location) ? `<div class="info-item"><span class="info-label">Location / Department</span><span class="info-value">${c.location || c.Location}</span></div>` : ''}
        ${(c.reportedByName || c.ReportedByName) ? `<div class="info-item"><span class="info-label">Reported By</span><span class="info-value">${c.reportedByName || c.ReportedByName}</span></div>` : ''}
        ${(c.reportedByEmail || c.ReportedByEmail) ? `<div class="info-item"><span class="info-label">Reported Email</span><span class="info-value">${c.reportedByEmail || c.ReportedByEmail}</span></div>` : ''}
        ${(c.rootCause || c.RootCause) ? `<div class="info-item" style="grid-column:span 2;"><span class="info-label">Root Cause</span><span class="info-value">${c.rootCause || c.RootCause}</span></div>` : ''}
        ${(c.contributingFactors || c.ContributingFactors) ? `<div class="info-item" style="grid-column:span 2;"><span class="info-label">Contributing Factors</span><span class="info-value">${c.contributingFactors || c.ContributingFactors}</span></div>` : ''}
        
        <div class="info-item"><span class="info-label">Responsible</span><span class="info-value">${c.responsiblePersonName || c.ResponsiblePersonName || '-'}</span></div>
        <div class="info-item"><span class="info-label">Email</span><span class="info-value">${c.responsiblePersonEmail || c.ResponsiblePersonEmail || '-'}</span></div>
        <div class="info-item"><span class="info-label">Due Date</span><span class="info-value">${new Date(c.dueDate || c.DueDate).toLocaleDateString()}</span></div>
        <div class="info-item"><span class="info-label">Priority</span><span class="badge badge-${capaGetPriorityBadge(c.priority || c.Priority || 'medium')}">${c.priority || c.Priority || '-'}</span></div>
        ${(c.status || c.Status) === 'verified' ? `
          <div class="info-item" style="grid-column:span 2; margin-top:12px; padding:12px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.2); border-radius:8px;">
            <div style="font-weight:700; color:#10b981; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Verification Details
            </div>
            <div style="font-size:13px; color:var(--text); margin-bottom:8px;">${c.verificationNotes || c.VerificationNotes}</div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted);">
              <span>Rating: <strong>${(c.effectivenessRating || c.EffectivenessRating || '').replace('_', ' ')}</strong></span>
              <span>Verified on: ${new Date(c.verificationDate || c.VerificationDate).toLocaleDateString()}</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
    
    <div id="capa-tab-activity" style="display:none;">
      <div class="add-comment-section">
        <div class="comment-input-group">
          <div class="avatar">A</div>
          <textarea id="new-comment" placeholder="Add a comment... Use @name to mention someone" rows="2" oninput="updateCharCounter(this)"></textarea>
        </div>
        <div class="comment-actions">
          <small class="char-counter" id="char-counter">0 / 2000</small>
          <button type="button" class="btn btn-primary" id="post-comment-btn" onclick="postComment('${c.id || c.Id}')" style="padding:6px 16px; font-size:12px;">Post Comment</button>
        </div>
      </div>
      <hr style="border:none; border-top:1px solid var(--border); margin:20px 0;">
      <div class="activity-feed" id="activity-feed">
        <div style="text-align:center; padding:20px; color:var(--text-muted);">Loading activity...</div>
      </div>
    </div>

    <div id="capa-tab-attachments" style="display:none;">
      <div class="file-upload-zone" id="capa-drop-zone" onclick="document.getElementById('capa-file-input').click()">
        <input type="file" id="capa-file-input" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls" onchange="handleCapaFiles(this.files, '${c.id || c.Id}')">
        <div class="upload-prompt">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p>Drag & drop files here or <a href="#">browse</a></p>
          <small>Supported: PDF, Images, Word, Excel (max 10MB)</small>
        </div>
      </div>
      <div class="attachments-grid" id="capa-attachments-grid"></div>
    </div>

    <div id="capa-tab-history" style="display:none;">
      <div class="capa-filter-card">
        <div class="capa-filter-row">
          <div class="capa-filter-pills" id="capa-quick-filter-pills">
            <button type="button" class="filter-pill active" onclick="setCapaHistoryQuickFilter('${c.id || c.Id}', 'all', this)">All Activity</button>
            <button type="button" class="filter-pill" onclick="setCapaHistoryQuickFilter('${c.id || c.Id}', 'today', this)">Today</button>
            <button type="button" class="filter-pill" onclick="setCapaHistoryQuickFilter('${c.id || c.Id}', 'week', this)">This Week</button>
            <button type="button" class="filter-pill" onclick="setCapaHistoryQuickFilter('${c.id || c.Id}', 'month', this)">This Month</button>
          </div>
        </div>
        <button type="button" class="advanced-filters-toggle" onclick="toggleCapaAdvancedFilters('${c.id || c.Id}')">
          Advanced Filters
        </button>
        <div class="advanced-filters-panel" id="capa-advanced-filters-panel" style="display:none;">
          <div class="advanced-filters-grid">
            <div class="form-group">
              <label class="form-label">Date Range</label>
              <div style="display:flex; gap:10px;">
                <input type="date" class="form-input" id="capa-filter-from">
                <input type="date" class="form-input" id="capa-filter-to">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">User</label>
              <select class="form-input" id="capa-filter-user"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-input" id="capa-filter-status"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Field Changed</label>
              <select class="form-input" id="capa-filter-field"></select>
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Action Type</label>
              <div class="checkbox-list">
                <label class="checkbox-item"><input type="checkbox" id="capa-type-created" checked>Created</label>
                <label class="checkbox-item"><input type="checkbox" id="capa-type-field" checked>Field Changes</label>
                <label class="checkbox-item"><input type="checkbox" id="capa-type-comments" checked>Comments</label>
                <label class="checkbox-item"><input type="checkbox" id="capa-type-attachments" checked>Attachments</label>
                <label class="checkbox-item"><input type="checkbox" id="capa-type-assignments" checked>Assignments</label>
              </div>
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label class="form-label">Search in Changes</label>
              <input type="text" class="form-input" id="capa-filter-search" placeholder="Search in old/new values, reasons...">
            </div>
          </div>
          <div class="advanced-filters-actions">
            <button type="button" class="btn btn-ghost" onclick="resetCapaHistoryFilters('${c.id || c.Id}')">Reset All</button>
            <button type="button" class="btn btn-primary" onclick="applyCapaHistoryFilters('${c.id || c.Id}')">Apply Filters</button>
          </div>
        </div>
      </div>
      <div id="capa-history-feed"></div>
    </div>
  `;
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (btn) btn.style.display = 'none';
  document.getElementById('modal-overlay').classList.add('active');
}

function switchCapaTab(ev, tab, capaId) {
  const clicked = ev?.currentTarget || ev?.target;
  if (clicked) capaSetActiveTabButton(clicked);

  if (tab === 'info') {
    document.getElementById('capa-tab-info').style.display = 'block';
    document.getElementById('capa-tab-activity').style.display = 'none';
    document.getElementById('capa-tab-attachments').style.display = 'none';
    document.getElementById('capa-tab-history').style.display = 'none';
  } else if (tab === 'activity') {
    document.getElementById('capa-tab-info').style.display = 'none';
    document.getElementById('capa-tab-activity').style.display = 'block';
    document.getElementById('capa-tab-attachments').style.display = 'none';
    document.getElementById('capa-tab-history').style.display = 'none';
    loadActivityFeed(capaId);
  } else if (tab === 'attachments') {
    document.getElementById('capa-tab-info').style.display = 'none';
    document.getElementById('capa-tab-activity').style.display = 'none';
    document.getElementById('capa-tab-attachments').style.display = 'block';
    document.getElementById('capa-tab-history').style.display = 'none';
    loadCapaAttachments(capaId);
  } else if (tab === 'history') {
    document.getElementById('capa-tab-info').style.display = 'none';
    document.getElementById('capa-tab-activity').style.display = 'none';
    document.getElementById('capa-tab-attachments').style.display = 'none';
    document.getElementById('capa-tab-history').style.display = 'block';
    loadCapaHistory(capaId);
  }
}

function prettyAuditAction(action, metadata) {
  const a = action ? String(action) : '';
  const field = metadata && typeof metadata === 'object' ? (metadata.field || metadata.Field) : null;
  if (field) return `${a.replace(/_/g, ' ')} (${String(field).replace(/_/g, ' ')})`;
  return a.replace(/_/g, ' ');
}

function getCapaHistoryUiState(capaId) {
  const key = String(capaId || '');
  if (!capaHistoryUi[key]) {
    capaHistoryUi[key] = {
      quick: 'all',
      dateFrom: '',
      dateTo: '',
      user: 'all',
      status: 'all',
      field: 'all',
      search: '',
      types: {
        created: true,
        field: true,
        comments: true,
        attachments: true,
        assignments: true
      }
    };
  }
  return capaHistoryUi[key];
}

function setPillActive(pillEl) {
  const container = pillEl?.closest?.('.capa-filter-pills');
  if (!container) return;
  container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  pillEl.classList.add('active');
}

function setCapaHistoryQuickFilter(capaId, quick, pillEl) {
  const ui = getCapaHistoryUiState(capaId);
  ui.quick = quick;
  ui.dateFrom = '';
  ui.dateTo = '';
  if (pillEl) setPillActive(pillEl);
  syncCapaHistoryControlsFromState(capaId);
  renderCapaHistoryFromCache(capaId);
}

function toggleCapaAdvancedFilters(capaId) {
  const panel = document.getElementById('capa-advanced-filters-panel');
  if (!panel) return;
  const willOpen = panel.style.display === 'none';
  panel.style.display = willOpen ? 'block' : 'none';
  if (willOpen) {
    syncCapaHistoryControlsFromState(capaId);
  }
}

function syncCapaHistoryControlsFromState(capaId) {
  const ui = getCapaHistoryUiState(capaId);
  const from = document.getElementById('capa-filter-from');
  const to = document.getElementById('capa-filter-to');
  const user = document.getElementById('capa-filter-user');
  const status = document.getElementById('capa-filter-status');
  const field = document.getElementById('capa-filter-field');
  const search = document.getElementById('capa-filter-search');
  if (from) from.value = ui.dateFrom || '';
  if (to) to.value = ui.dateTo || '';
  if (user) user.value = ui.user || 'all';
  if (status) status.value = ui.status || 'all';
  if (field) field.value = ui.field || 'all';
  if (search) search.value = ui.search || '';

  const created = document.getElementById('capa-type-created');
  const fieldCb = document.getElementById('capa-type-field');
  const comments = document.getElementById('capa-type-comments');
  const attachments = document.getElementById('capa-type-attachments');
  const assignments = document.getElementById('capa-type-assignments');
  if (created) created.checked = !!ui.types.created;
  if (fieldCb) fieldCb.checked = !!ui.types.field;
  if (comments) comments.checked = !!ui.types.comments;
  if (attachments) attachments.checked = !!ui.types.attachments;
  if (assignments) assignments.checked = !!ui.types.assignments;
}

function readCapaHistoryControlsToState(capaId) {
  const ui = getCapaHistoryUiState(capaId);
  const from = document.getElementById('capa-filter-from');
  const to = document.getElementById('capa-filter-to');
  const user = document.getElementById('capa-filter-user');
  const status = document.getElementById('capa-filter-status');
  const field = document.getElementById('capa-filter-field');
  const search = document.getElementById('capa-filter-search');

  ui.dateFrom = from?.value || '';
  ui.dateTo = to?.value || '';
  ui.user = user?.value || 'all';
  ui.status = status?.value || 'all';
  ui.field = field?.value || 'all';
  ui.search = search?.value || '';

  ui.types.created = !!document.getElementById('capa-type-created')?.checked;
  ui.types.field = !!document.getElementById('capa-type-field')?.checked;
  ui.types.comments = !!document.getElementById('capa-type-comments')?.checked;
  ui.types.attachments = !!document.getElementById('capa-type-attachments')?.checked;
  ui.types.assignments = !!document.getElementById('capa-type-assignments')?.checked;
}

function resetCapaHistoryFilters(capaId) {
  const ui = getCapaHistoryUiState(capaId);
  ui.quick = 'all';
  ui.dateFrom = '';
  ui.dateTo = '';
  ui.user = 'all';
  ui.status = 'all';
  ui.field = 'all';
  ui.search = '';
  ui.types = { created: true, field: true, comments: true, attachments: true, assignments: true };

  const pills = document.getElementById('capa-quick-filter-pills');
  if (pills) {
    const first = pills.querySelector('.filter-pill');
    if (first) setPillActive(first);
  }
  syncCapaHistoryControlsFromState(capaId);
  renderCapaHistoryFromCache(capaId);
}

function applyCapaHistoryFilters(capaId) {
  readCapaHistoryControlsToState(capaId);
  renderCapaHistoryFromCache(capaId);
}

function getStartOfWeek(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const mondayBased = (day + 6) % 7;
  date.setDate(date.getDate() - mondayBased);
  date.setHours(0, 0, 0, 0);
  return date;
}

function classifyCapaHistoryType(h) {
  const action = (h?.action || '').toString().toLowerCase();
  const field = h?.metadata && typeof h.metadata === 'object' ? ((h.metadata.field || h.metadata.Field || '') + '').toLowerCase() : '';
  if (action.includes('created')) return 'created';
  if (action.includes('comment')) return 'comments';
  if (action.includes('attachment') || action.includes('upload')) return 'attachments';
  if (action.includes('assigned') || field.includes('assigned') || field.includes('responsible')) return 'assignments';
  return 'field';
}

function normalizeStatusValue(v) {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

function buildCapaFilterOptionsFromHistory(history) {
  const users = new Set();
  const fields = new Set();
  const statuses = new Set();

  (history || []).forEach(h => {
    if (h?.userName) users.add(String(h.userName));
    const f = h?.metadata && typeof h.metadata === 'object' ? (h.metadata.field || h.metadata.Field) : null;
    if (f) fields.add(String(f));
    const isStatus = normalizeStatusValue(f) === 'status' || String(h?.action || '').toLowerCase().includes('status');
    if (isStatus) {
      const oldS = normalizeStatusValue(h?.oldValue);
      const newS = normalizeStatusValue(h?.newValue);
      if (oldS) statuses.add(oldS);
      if (newS) statuses.add(newS);
    }
  });

  return {
    users: Array.from(users).sort((a, b) => a.localeCompare(b)),
    fields: Array.from(fields).sort((a, b) => a.localeCompare(b)),
    statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b))
  };
}

function populateCapaHistoryFilterControls(history) {
  const { users, fields, statuses } = buildCapaFilterOptionsFromHistory(history);

  const userSelect = document.getElementById('capa-filter-user');
  if (userSelect) {
    userSelect.innerHTML = ['<option value="all">All Users</option>']
      .concat(users.map(u => `<option value="${capaEscapeHtml(u)}">${capaEscapeHtml(u)}</option>`))
      .join('');
  }

  const statusSelect = document.getElementById('capa-filter-status');
  if (statusSelect) {
    statusSelect.innerHTML = ['<option value="all">Any Status</option>']
      .concat(statuses.map(s => `<option value="${capaEscapeHtml(s)}">${capaEscapeHtml(s.replace(/_/g, ' '))}</option>`))
      .join('');
  }

  const fieldSelect = document.getElementById('capa-filter-field');
  if (fieldSelect) {
    fieldSelect.innerHTML = ['<option value="all">Any Field</option>']
      .concat(fields.map(f => `<option value="${capaEscapeHtml(f)}">${capaEscapeHtml(f.replace(/_/g, ' '))}</option>`))
      .join('');
  }
}

function filterCapaHistory(history, ui) {
  const now = new Date();
  const quick = ui.quick || 'all';

  let start = null;
  let end = null;

  if (ui.dateFrom || ui.dateTo) {
    if (ui.dateFrom) {
      const d = new Date(ui.dateFrom + 'T00:00:00');
      if (!isNaN(d.getTime())) start = d;
    }
    if (ui.dateTo) {
      const d = new Date(ui.dateTo + 'T23:59:59');
      if (!isNaN(d.getTime())) end = d;
    }
  } else if (quick === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (quick === 'week') {
    start = getStartOfWeek(now);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (quick === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  const searchTerm = (ui.search || '').trim().toLowerCase();
  const selectedUser = ui.user || 'all';
  const selectedStatus = ui.status || 'all';
  const selectedField = ui.field || 'all';
  const enabledTypes = ui.types || {};

  return (history || [])
    .filter(h => {
      const ts = new Date(h.timestamp);
      if (start && (!h.timestamp || isNaN(ts.getTime()) || ts < start)) return false;
      if (end && (!h.timestamp || isNaN(ts.getTime()) || ts > end)) return false;

      if (selectedUser !== 'all' && String(h.userName || '') !== selectedUser) return false;

      const type = classifyCapaHistoryType(h);
      if (!enabledTypes[type]) return false;

      const field = h?.metadata && typeof h.metadata === 'object' ? (h.metadata.field || h.metadata.Field) : null;
      if (selectedField !== 'all') {
        if (!field || String(field) !== selectedField) return false;
      }

      if (selectedStatus !== 'all') {
        const isStatusEntry = normalizeStatusValue(field) === 'status' || String(h?.action || '').toLowerCase().includes('status');
        if (!isStatusEntry) return false;
        const oldS = normalizeStatusValue(h?.oldValue);
        const newS = normalizeStatusValue(h?.newValue);
        if (oldS !== selectedStatus && newS !== selectedStatus) return false;
      }

      if (searchTerm) {
        const hay = [
          h.userName,
          h.action,
          h.oldValue,
          h.newValue,
          h.changeReason
        ].map(x => (x == null ? '' : String(x))).join(' ').toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function renderCapaHistoryFromCache(capaId) {
  const feed = document.getElementById('capa-history-feed');
  if (!feed) return;
  const key = String(capaId || '');
  const history = capaHistoryCache[key] || [];
  const ui = getCapaHistoryUiState(capaId);
  const filtered = filterCapaHistory(history, ui);

  if (filtered.length === 0) {
    const uiMsg = (() => {
      if (ui.quick !== 'all' || ui.dateFrom || ui.dateTo || ui.user !== 'all' || ui.status !== 'all' || ui.field !== 'all' || (ui.search || '').trim()) return 'No activity matches the selected filters.';
      return 'No history yet.';
    })();
    feed.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">${uiMsg}</div>`;
    return;
  }

  feed.innerHTML = filtered.map(h => `
    <div class="activity-item activity-history" style="margin-bottom:16px;">
      <div class="activity-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M9 20v-10M15 20v-2M3 20h18"/></svg>
      </div>
      <div class="activity-content" style="background:transparent; border:none; padding:0;">
        <div class="activity-text"><strong>${capaEscapeHtml(h.userName)}</strong> ${capaEscapeHtml(prettyAuditAction(h.action, h.metadata))}</div>
        <span class="activity-time" title="${capaEscapeHtml(capaFormatAbsoluteTimestamp(h.timestamp))}">${capaFormatTimeAgo(h.timestamp)}</span>
        ${(h.oldValue != null || h.newValue != null) ? `
          <div class="value-diff-grid">
            <div class="value-diff-panel value-diff-old">
              <div class="value-diff-header"><span>Before</span><span>${capaEscapeHtml(h.oldValue == null ? '' : String(h.oldValue).length > 120 ? `${String(h.oldValue).length} chars` : '')}</span></div>
              <div class="value-diff-body">${capaEscapeHtml(h.oldValue == null ? '' : h.oldValue)}</div>
            </div>
            <div class="value-diff-panel value-diff-new">
              <div class="value-diff-header"><span>After</span><span>${capaEscapeHtml(h.newValue == null ? '' : String(h.newValue).length > 120 ? `${String(h.newValue).length} chars` : '')}</span></div>
              <div class="value-diff-body">${capaEscapeHtml(h.newValue == null ? '' : h.newValue)}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function loadCapaHistory(capaId) {
  const feed = document.getElementById('capa-history-feed');
  if (feed) feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading history...</div>';

  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/${capaId}/history`);
    const history = await res.json();
    const key = String(capaId || '');
    capaHistoryCache[key] = Array.isArray(history) ? history : [];
    populateCapaHistoryFilterControls(capaHistoryCache[key]);
    syncCapaHistoryControlsFromState(capaId);
    renderCapaHistoryFromCache(capaId);
  } catch (error) {
    if (feed) feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent3);">Error loading history.</div>';
  }
}

async function loadCapaAttachments(capaId) {
  const grid = document.getElementById('capa-attachments-grid');
  grid.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); grid-column:1/-1;">Loading attachments...</div>';

  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/${capaId}/attachments`);
    const attachments = await res.json();

    if (attachments.length === 0) {
      grid.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); grid-column:1/-1;">No attachments yet.</div>';
      return;
    }

    grid.innerHTML = attachments.map(a => `
      <div class="attachment-item" data-attachment-id="${a.id}">
        <div class="attachment-preview">
          ${isImage(a.fileName) ? `<img src="${capaApiBaseUrl().replace('/api', '')}${a.fileUrl}" alt="${a.fileName}">` : `<div class="file-icon">${getFileIcon(a.fileName)}</div>`}
        </div>
        <div class="attachment-info">
          <div class="attachment-name" title="${a.fileName}">${a.fileName}</div>
          <div class="attachment-meta">${formatFileSize(a.fileSize)} • ${capaFormatTimeAgo(a.uploadedAt)}</div>
        </div>
        <div class="attachment-actions">
          <button class="btn-icon" onclick="downloadCapaFile('${a.id}')" title="Download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
          <button class="btn-icon text-danger" onclick="deleteCapaFile('${a.id}', '${capaId}')" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    grid.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent3); grid-column:1/-1;">Error loading attachments.</div>';
  }
}

async function handleCapaFiles(files, capaId) {
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      alert(`${file.name} is too large (max 10MB)`);
      continue;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${capaApiBaseUrl()}/capa/${capaId}/attachments`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) loadCapaAttachments(capaId);
      else alert(`Failed to upload ${file.name}`);
    } catch (error) {
      console.error('Upload error:', error);
    }
  }
}

async function downloadCapaFile(id) {
  window.open(`${capaApiBaseUrl()}/capa/attachments/${id}/download`, '_blank');
}

async function deleteCapaFile(id, capaId) {
  if (!confirm('Delete this file?')) return;
  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/attachments/${id}`, { method: 'DELETE' });
    if (res.ok) loadCapaAttachments(capaId);
  } catch (error) {
    console.error(error);
  }
}

function isImage(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  return '📁';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateCharCounter(el) {
  const count = el.value.length;
  document.getElementById('char-counter').textContent = `${count} / 2000`;
  document.getElementById('post-comment-btn').disabled = count === 0 || count > 2000;
}

async function postComment(capaId) {
  const textarea = document.getElementById('new-comment');
  const comment = textarea.value.trim();
  if (!comment) return;

  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/${capaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment })
    });

    if (res.ok) {
      textarea.value = '';
      updateCharCounter(textarea);
      loadActivityFeed(capaId);
    } else {
      alert('Failed to post comment');
    }
  } catch (error) {
    console.error('Error posting comment:', error);
  }
}

async function loadActivityFeed(capaId) {
  const feed = document.getElementById('activity-feed');
  try {
    const [comments, history] = await Promise.all([
      fetch(`${capaApiBaseUrl()}/capa/${capaId}/comments`).then(r => r.json()),
      fetch(`${capaApiBaseUrl()}/capa/${capaId}/history`).then(r => r.json())
    ]);

    const activities = [
      ...comments.map(c => ({ ...c, type: 'comment', timestamp: c.createdAt })),
      ...history.map(h => ({ ...h, type: 'history', timestamp: h.timestamp }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (activities.length === 0) {
      feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No activity yet.</div>';
      return;
    }

    feed.innerHTML = activities.map(a => {
      const timeAgo = capaFormatTimeAgo(a.timestamp);
      if (a.type === 'comment') {
        return `
          <div class="activity-item" data-comment-id="${a.id}">
            <div class="avatar">${a.userName.charAt(0)}</div>
            <div class="activity-content">
              <div class="activity-header">
                <strong>${a.userName}</strong>
                <span class="activity-time">${timeAgo}</span>
                ${a.isEdited ? '<span class="edited-badge">edited</span>' : ''}
              </div>
              <div class="comment-text">${parseMentions(a.comment)}</div>
              <div class="activity-comment-actions">
                <button type="button" class="btn-link" onclick="editComment('${a.id}', '${capaId}')">Edit</button>
                <button type="button" class="btn-link text-danger" onclick="deleteComment('${a.id}', '${capaId}')">Delete</button>
              </div>
            </div>
          </div>`;
      }
      return `
          <div class="activity-item activity-history">
            <div class="activity-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M9 20v-10M15 20v-2M3 20h18"/></svg>
            </div>
            <div class="activity-content" style="background:transparent; border:none; padding:0;">
              <div class="activity-text"><strong>${a.userName}</strong> ${a.action}</div>
              <span class="activity-time">${timeAgo}</span>
            </div>
          </div>`;
    }).join('');
  } catch (error) {
    feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent3);">Error loading activity.</div>';
  }
}

function parseMentions(text) {
  return text.replace(/@(\w+)/g, '<mark>@$1</mark>');
}

async function deleteComment(commentId, capaId) {
  if (!confirm('Delete this comment?')) return;
  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) loadActivityFeed(capaId);
  } catch (error) {
    console.error(error);
  }
}

function editComment(commentId, capaId) {
  const container = document.querySelector(`[data-comment-id="${commentId}"] .comment-text`);
  const originalText = container.textContent;
  container.innerHTML = `
    <textarea class="edit-textarea" rows="2">${originalText}</textarea>
    <div class="edit-actions">
      <button type="button" class="btn-sm" onclick="loadActivityFeed('${capaId}')">Cancel</button>
      <button type="button" class="btn-sm btn-primary" onclick="saveCommentEdit('${commentId}', '${capaId}')">Save</button>
    </div>
  `;
}

async function saveCommentEdit(commentId, capaId) {
  const textarea = document.querySelector(`[data-comment-id="${commentId}"] .edit-textarea`);
  const text = textarea.value.trim();
  if (!text) return;
  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: text })
    });
    if (res.ok) loadActivityFeed(capaId);
  } catch (error) {
    console.error(error);
  }
}

async function editCapa(id) {
  console.log('editCapa called with id:', id);
  try {
    const response = await fetch(`${capaApiBaseUrl()}/capa/${id}`);
    const c = await response.json();
    console.log('Fetched CAPA data:', c);

    buildCapaForm();
    document.getElementById('modal-title').textContent = 'Edit CAPA Action';
    document.getElementById('form-id').value = id;

    setTimeout(() => {
      const f = document.getElementById('record-form');
      if (f) {
        console.log('Populating form fields...');

        const ncrRefInput = f.querySelector('[name="ncrReference"]');
        const ncrTitleInput = f.querySelector('[name="ncrTitle"]');
        const ncrDescInput = f.querySelector('[name="ncrDescription"]');
        const occurrenceDateInput = f.querySelector('[name="occurrenceDate"]');
        const locationInput = f.querySelector('[name="location"]');
        const reportedByNameInput = f.querySelector('[name="reportedByName"]');
        const reportedByEmailInput = f.querySelector('[name="reportedByEmail"]');
        const rootCauseInput = f.querySelector('[name="rootCause"]');
        const contributingFactorsInput = f.querySelector('[name="contributingFactors"]');

        const titleInput = f.querySelector('[name="title"]');
        const actionTypeInput = f.querySelector('[name="actionType"]');
        const descInput = f.querySelector('[name="description"]');
        const respIdInput = f.querySelector('[name="responsiblePersonId"]');
        const respNameInput = f.querySelector('[name="responsiblePersonName"]');
        const respEmailInput = f.querySelector('[name="responsiblePersonEmail"]');
        const dueDateInput = f.querySelector('[name="dueDate"]');
        const priorityInput = f.querySelector('[name="priority"]');
        const statusInput = f.querySelector('[name="status"]');
        const ncrIdInput = f.querySelector('[name="ncrId"]');

        if (titleInput) titleInput.value = c.Title || c.title || '';
        if (actionTypeInput) actionTypeInput.value = c.ActionType || c.actionType || 'corrective';
        if (descInput) descInput.value = c.Description || c.description || '';
        if (respIdInput) respIdInput.value = c.ResponsiblePersonId || c.responsiblePersonId || 0;
        if (respNameInput) respNameInput.value = c.ResponsiblePersonName || c.responsiblePersonName || '';
        if (respEmailInput) respEmailInput.value = c.ResponsiblePersonEmail || c.responsiblePersonEmail || '';
        if (dueDateInput && (c.DueDate || c.dueDate)) {
          dueDateInput.value = (c.DueDate || c.dueDate).split('T')[0];
        }
        if (priorityInput) priorityInput.value = c.Priority || c.priority || 'medium';
        if (statusInput) statusInput.value = c.Status || c.status || 'not_started';
        if (ncrIdInput) ncrIdInput.value = c.NCRId || c.ncrId || '';

        if (ncrRefInput) ncrRefInput.value = c.NCRReference || c.ncrReference || `NCR-${c.NCRId || '001'}`;
        if (ncrTitleInput) ncrTitleInput.value = c.NCRTitle || c.ncrTitle || (c.Title || c.title || '');
        if (ncrDescInput) ncrDescInput.value = c.NCRDescription || c.ncrDescription || (c.Description || c.description || '');
        if (occurrenceDateInput && (c.OccurrenceDate || c.occurrenceDate)) {
          occurrenceDateInput.value = (c.OccurrenceDate || c.occurrenceDate).split('T')[0];
        }
        if (locationInput) locationInput.value = c.Location || c.location || '';
        if (reportedByNameInput) reportedByNameInput.value = c.ReportedByName || c.reportedByName || '';
        if (reportedByEmailInput) reportedByEmailInput.value = c.ReportedByEmail || c.reportedByEmail || '';
        if (rootCauseInput) rootCauseInput.value = c.RootCause || c.rootCause || '';
        if (contributingFactorsInput) contributingFactorsInput.value = c.ContributingFactors || c.contributingFactors || '';

        console.log('Form fields populated');
      }
    }, 200);

    document.getElementById('modal-overlay').classList.add('active');
  } catch (err) {
    console.error('Error in editCapa:', err);
    alert('Error loading CAPA: ' + err.message);
  }
}

async function deleteCapa(id) {
  if (confirm('Delete this CAPA action?')) {
    const res = await fetch(`${capaApiBaseUrl()}/capa/${id}`, { method: 'DELETE' });
    if (res.ok) fetchCapas();
  }
}

function selectEffectiveness(el) {
  document.querySelectorAll('.radio-label').forEach(l => l.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
}

async function openVerificationModal(id) {
  try {
    currentCapaIdForVerification = id;

    document.getElementById('verify-action-title').textContent = 'Loading...';
    document.getElementById('verify-responsible-name').textContent = '...';
    document.getElementById('verify-completion-date').textContent = '...';
    document.getElementById('verification-modal-overlay').classList.add('active');

    const res = await fetch(`${capaApiBaseUrl()}/capa/${id}`);
    if (!res.ok) throw new Error('Failed to fetch CAPA details');
    const c = await res.json();

    document.getElementById('verify-action-title').textContent = c.title || 'Untitled Action';
    document.getElementById('verify-responsible-name').textContent = c.responsiblePersonName || 'Unknown';
    document.getElementById('verify-completion-date').textContent = c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'N/A';

    document.getElementById('verification-form').reset();
    document.querySelectorAll('.radio-label').forEach(l => l.classList.remove('selected'));
  } catch (error) {
    console.error('Error opening verification modal:', error);
    alert('Error loading CAPA details: ' + error.message);
    closeVerificationModal();
  }
}

function closeVerificationModal() {
  document.getElementById('verification-modal-overlay').classList.remove('active');
}

async function submitVerificationForm(e) {
  e.preventDefault();

  const checkboxes = document.querySelectorAll('.checklist input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);

  if (!allChecked) {
    alert('Please complete all verification checklist items.');
    return;
  }

  const selectedRating = document.querySelector('input[name="effectiveness_rating"]:checked');
  if (!selectedRating) {
    alert('Please select an effectiveness rating.');
    return;
  }

  const formData = {
    verificationNotes: document.getElementById('verification_notes').value,
    effectivenessRating: selectedRating.value,
    verifiedById: 1,
    verificationDate: new Date().toISOString()
  };

  try {
    const res = await fetch(`${capaApiBaseUrl()}/capa/${currentCapaIdForVerification}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      closeVerificationModal();
      fetchCapas();
      alert('Action verified successfully!');
    } else {
      const err = await res.text();
      alert('Verification failed: ' + err);
    }
  } catch (error) {
    alert('Verification failed: ' + error.message);
  }
}

function bindCapaVerificationForm() {
  const form = document.getElementById('verification-form');
  if (!form || form.dataset.capaManagementBound === 'true') return;
  form.addEventListener('submit', submitVerificationForm);
  form.dataset.capaManagementBound = 'true';
}

bindCapaVerificationForm();

