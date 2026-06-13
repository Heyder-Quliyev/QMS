function auditsDeps() {
  return window.__auditsDeps || {};
}

function auditsApiBaseUrl() {
  return auditsDeps().API_BASE_URL || '/api';
}

function auditsGetStatusBadge(status) {
  const fn = auditsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function auditsShowPage(id, el) {
  const fn = auditsDeps().showPage || window.showPage;
  if (typeof fn === 'function') return fn(id, el);
}

function setAuditCurrentFormType(value) {
  const fn = auditsDeps().setCurrentFormType;
  if (typeof fn === 'function') fn(value);
}

let allAudits = [];

function buildAuditForm() {
  setAuditCurrentFormType('audits');
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (btn) btn.style.display = 'inline-flex';

  const title = document.getElementById('modal-title');
  const fields = document.getElementById('form-fields');
  const formId = document.getElementById('form-id');

  if (title) title.textContent = 'New Audit';
  if (formId) formId.value = '';
  if (fields) {
    fields.innerHTML = `<div class="form-group"><label class="form-label">Ref #</label><input type="text" name="referenceNumber" class="form-input" required></div><div class="form-group"><label class="form-label">Title</label><input type="text" name="title" class="form-input" required></div><div class="form-group"><label class="form-label">Type</label><select name="type" class="form-input"><option>Internal</option><option>External</option><option>Supplier</option></select></div><div class="form-group"><label class="form-label">Auditor</label><input type="text" name="auditor" class="form-input" required></div><div class="form-row"><div class="form-group"><label class="form-label">Due Date</label><input type="date" name="dueDate" class="form-input" required></div><div class="form-group"><label class="form-label">Status</label><select name="status" class="form-input"><option>Scheduled</option><option>In Progress</option><option>Closed</option><option>Overdue</option></select></div></div><div class="form-group"><label class="form-label">Findings</label><input type="number" name="findings" class="form-input" value="0"></div>`;
  }
}

function normalizeAuditFormData(data) {
  data.findings = data.findings ? parseInt(data.findings, 10) : 0;
  if (data.id) data.id = parseInt(data.id, 10);
  return data;
}

async function fetchAudits() {
  const res = await fetch(`${auditsApiBaseUrl()}/audits`);
  allAudits = await res.json();
  updateAuditStats();
  filterAudits();
}

function updateAuditStats() {
  const s = {
    total: allAudits.length,
    scheduled: allAudits.filter(a => a.status === 'Scheduled').length,
    inprogress: allAudits.filter(a => a.status === 'In Progress').length,
    closed: allAudits.filter(a => a.status === 'Closed').length,
    overdue: allAudits.filter(a => a.status === 'Overdue').length
  };
  const totalEl = document.getElementById('stat-total');
  const scheduledEl = document.getElementById('stat-scheduled');
  const inProgressEl = document.getElementById('stat-inprogress');
  const closedEl = document.getElementById('stat-closed');
  const overdueEl = document.getElementById('stat-overdue');

  if (totalEl) totalEl.textContent = s.total;
  if (scheduledEl) scheduledEl.textContent = s.scheduled;
  if (inProgressEl) inProgressEl.textContent = s.inprogress;
  if (closedEl) closedEl.textContent = s.closed;
  if (overdueEl) overdueEl.textContent = s.overdue;

  const today = new Date().toISOString().split('T')[0];
  const todayAudits = allAudits.filter(a => a.dueDate.split('T')[0] === today && a.status !== 'Closed').length;
  const badge = document.getElementById('audit-nav-badge');
  if (!badge) return;
  if (todayAudits > 0) {
    badge.textContent = todayAudits;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function filterAudits() {
  const term = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const sort = document.getElementById('audit-sort')?.value || 'newest';
  const filtered = allAudits.filter(a =>
    a.title.toLowerCase().includes(term) ||
    a.referenceNumber.toLowerCase().includes(term) ||
    a.auditor.toLowerCase().includes(term)
  );

  filtered.sort((a, b) => {
    if (sort === 'az') return a.title.localeCompare(b.title);
    if (sort === 'za') return b.title.localeCompare(a.title);
    if (sort === 'newest') return new Date(b.dueDate) - new Date(a.dueDate);
    if (sort === 'oldest') return new Date(a.dueDate) - new Date(b.dueDate);
    if (sort === 'findings-desc') return (b.findings || 0) - (a.findings || 0);
    if (sort === 'findings-asc') return (a.findings || 0) - (b.findings || 0);
    return 0;
  });

  renderAuditTable(filtered);
}

function renderAuditTable(audits) {
  const tbody = document.querySelector('#page-audits .data-table tbody');
  if (!tbody) return;
  tbody.innerHTML = audits.map(a => `
    <tr>
      <td style="font-weight:500;color:var(--accent2)">${a.referenceNumber}</td><td>${a.title}</td>
      <td><span class="badge badge-${a.type === 'Internal' ? 'blue' : (a.type === 'External' ? 'green' : 'gray')}">${a.type}</span></td>
      <td>${a.auditor}</td><td>${new Date(a.dueDate).toLocaleDateString()}</td>
      <td><span class="badge badge-${auditsGetStatusBadge(a.status)}">${a.status}</span></td><td>${a.findings || '0'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-icon" onclick="viewAudit(${a.id})" title="Info"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>
          <button class="btn-icon edit" onclick="editAudit(${a.id})" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon delete" onclick="deleteAudit(${a.id})" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
        </div>
      </td>
    </tr>`).join('');
}

async function viewAudit(id) {
  const a = await (await fetch(`${auditsApiBaseUrl()}/audits/${id}`)).json();
  document.getElementById('modal-title').textContent = 'Audit Info';
  document.getElementById('form-fields').innerHTML = `<div class="info-grid"><div class="info-item"><span class="info-label">Ref #</span><span class="info-value">${a.referenceNumber}</span></div><div class="info-item"><span class="info-label">Type</span><span class="badge badge-${a.type === 'Internal' ? 'blue' : (a.type === 'External' ? 'green' : 'gray')}">${a.type}</span></div><div class="info-item" style="grid-column:span 2;"><span class="info-label">Title</span><span class="info-value">${a.title}</span></div><div class="info-item"><span class="info-label">Auditor</span><span class="info-value">${a.auditor}</span></div><div class="info-item"><span class="info-label">Due Date</span><span class="info-value">${new Date(a.dueDate).toLocaleDateString()}</span></div><div class="info-item"><span class="info-label">Findings</span><span class="info-value">${a.findings || 0}</span></div><div class="info-item"><span class="info-label">Status</span><span class="badge badge-${auditsGetStatusBadge(a.status)}">${a.status}</span></div></div><div class="form-group" style="margin-top:20px;border-top:1px solid var(--border);padding-top:20px;"><label class="form-label">Update Status</label><select class="form-input" onchange="updateAuditStatus(${a.id}, this.value)"><option value="Scheduled" ${a.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option><option value="In Progress" ${a.status === 'In Progress' ? 'selected' : ''}>In Progress</option><option value="Closed" ${a.status === 'Closed' ? 'selected' : ''}>Closed</option><option value="Overdue" ${a.status === 'Overdue' ? 'selected' : ''}>Overdue</option></select></div>`;
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (btn) btn.style.display = 'none';
  document.getElementById('modal-overlay').classList.add('active');
}

async function updateAuditStatus(id, s) {
  const a = await (await fetch(`${auditsApiBaseUrl()}/audits/${id}`)).json();
  a.status = s;
  const res = await fetch(`${auditsApiBaseUrl()}/audits/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a)
  });
  if (res.ok) {
    auditsShowPage('audits');
    const badges = document.querySelectorAll('.info-item .badge');
    const badge = badges[badges.length - 1];
    if (badge) {
      badge.textContent = s;
      badge.className = `badge badge-${auditsGetStatusBadge(s)}`;
    }
  }
}

async function editAudit(id) {
  const a = await (await fetch(`${auditsApiBaseUrl()}/audits/${id}`)).json();
  buildAuditForm();
  document.getElementById('modal-title').textContent = 'Edit Audit';
  document.getElementById('form-id').value = a.id;
  const f = document.getElementById('record-form');
  f.referenceNumber.value = a.referenceNumber;
  f.title.value = a.title;
  f.type.value = a.type;
  f.auditor.value = a.auditor;
  f.dueDate.value = a.dueDate.split('T')[0];
  f.status.value = a.status;
  f.findings.value = a.findings;
  document.getElementById('modal-overlay').classList.add('active');
}

async function deleteAudit(id) {
  if (confirm('Delete?')) {
    const res = await fetch(`${auditsApiBaseUrl()}/audits/${id}`, { method: 'DELETE' });
    if (res.ok) auditsShowPage('audits');
  }
}

