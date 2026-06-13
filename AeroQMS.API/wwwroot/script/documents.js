function documentsDeps() {
  return window.__documentsDeps || {};
}

function documentsApiBaseUrl() {
  return documentsDeps().API_BASE_URL || '/api';
}

function documentsGetStatusBadge(status) {
  const fn = documentsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function documentsViewDocument(id) {
  const fn = documentsDeps().viewDocument;
  if (typeof fn === 'function') return fn(id);
}

let allDocuments = [];

function buildDocumentForm() {
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (btn) btn.style.display = 'inline-flex';
  const title = document.getElementById('modal-title');
  const fields = document.getElementById('form-fields');
  const formId = document.getElementById('form-id');

  if (title) title.textContent = 'New Document';
  if (formId) formId.value = '';
  if (fields) {
    fields.innerHTML = `
      <div class="form-group"><label class="form-label">Doc #</label><input type="text" name="documentNumber" class="form-input" required></div>
      <div class="form-group"><label class="form-label">Title</label><input type="text" name="title" class="form-input" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Category</label><input type="text" name="category" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Department</label><input type="text" name="department" class="form-input" required></div>
      </div>
      <div class="form-group"><label class="form-label">Revision</label><input type="text" name="revision" class="form-input" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Effective Date</label><input type="date" name="effectiveDate" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Review Date</label><input type="date" name="reviewDate" class="form-input" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Status</label><select name="status" class="form-input"><option>Approved</option><option>Due for Review</option><option>Expired</option></select></div>
        <div class="form-group"><label class="form-label">Owner</label><input type="text" name="owner" class="form-input" required></div>
      </div>
      <div class="form-group"><label class="form-label">Document File</label><input type="file" name="file" class="form-input"></div>
    `;
  }
}

async function fetchDocuments() {
  const res = await fetch(`${documentsApiBaseUrl()}/documents`);
  allDocuments = await res.json();
  updateDocumentStats();
  filterDocuments();
}

function updateDocumentStats() {
  const s = {
    total: allDocuments.length,
    approved: allDocuments.filter(d => d.status.toLowerCase() === 'approved').length,
    review: allDocuments.filter(d => d.status.toLowerCase() === 'due for review').length,
    expired: allDocuments.filter(d => d.status.toLowerCase() === 'expired').length
  };
  document.getElementById('doc-stat-total').textContent = s.total;
  document.getElementById('doc-stat-approved').textContent = s.approved;
  document.getElementById('doc-stat-review').textContent = s.review;
  document.getElementById('doc-stat-expired').textContent = s.expired;
}

function filterDocuments() {
  const term = document.getElementById('doc-search').value.toLowerCase();
  const sort = document.getElementById('doc-sort').value;
  let filtered = allDocuments.filter(d =>
    d.title.toLowerCase().includes(term) ||
    d.documentNumber.toLowerCase().includes(term) ||
    d.owner.toLowerCase().includes(term) ||
    (d.category && d.category.toLowerCase().includes(term)) ||
    (d.department && d.department.toLowerCase().includes(term))
  );
  filtered.sort((a, b) => {
    if (sort === 'az') return a.title.localeCompare(b.title);
    if (sort === 'za') return b.title.localeCompare(a.title);
    if (sort === 'newest') return new Date(b.reviewDate) - new Date(a.reviewDate);
    if (sort === 'oldest') return new Date(a.reviewDate) - new Date(b.reviewDate);
    return 0;
  });
  renderDocumentTable(filtered);
}

function renderDocumentTable(docs) {
  const tbody = document.querySelector('#page-documents .data-table tbody');
  const now = new Date();
  const oneWeekLater = new Date();
  oneWeekLater.setDate(now.getDate() + 7);

  tbody.innerHTML = docs.map(d => {
    const reviewDate = new Date(d.reviewDate);
    const isExpiringSoon = reviewDate > now && reviewDate <= oneWeekLater;

    return `
    <tr>
      <td style="width: 40px; text-align: center;"><input type="checkbox" class="doc-checkbox" value="${d.id}" style="cursor: pointer;"></td>
      <td style="color:var(--accent2);font-weight:600;white-space:nowrap;">
        ${isExpiringSoon ? '<span class="expiry-warning" title="Expiring within 1 week"></span>' : ''}${d.documentNumber}
      </td>
      <td style="max-width: 250px; line-height: 1.4;">${d.title}</td>
      <td><span class="badge badge-blue">${d.category}</span></td>
      <td style="white-space:nowrap;">${d.department || '-'}</td>
      <td style="white-space:nowrap;">${d.revision}</td>
      <td style="white-space:nowrap;">${new Date(d.effectiveDate).toLocaleDateString()}</td>
      <td style="white-space:nowrap;">${new Date(d.reviewDate).toLocaleDateString()}</td>
      <td><span class="badge badge-${documentsGetStatusBadge(d.status)}">${d.status}</span></td>
      <td style="white-space:nowrap;">${d.owner}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" onclick="viewDocument(${d.id})" title="Info"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>
          <button class="btn-icon edit" onclick="editDocument(${d.id})" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon delete" onclick="deleteDocument(${d.id})" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
          <button class="btn-icon" onclick="exportDocument(${d.id}, 'pdf')" title="Export PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
          ${d.fileName ? `<button class="btn-icon" onclick="downloadDocument(${d.id})" title="Download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function toggleSelectAllDocs(master) {
  document.querySelectorAll('.doc-checkbox').forEach(cb => cb.checked = master.checked);
}

async function exportDocument(id, format) {
  if (format === 'pdf') {
    window.open(`${documentsApiBaseUrl()}/documents/export/pdf/${id}`, '_blank');
  } else {
    bulkExport('csv', [id]);
  }
}

async function bulkExport(format, specificIds = null) {
  const ids = specificIds || Array.from(document.querySelectorAll('.doc-checkbox:checked')).map(cb => parseInt(cb.value, 10));
  if (ids.length === 0) {
    alert('Please select at least one document.');
    return;
  }

  const response = await fetch(`${documentsApiBaseUrl()}/documents/export/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, format })
  });

  if (response.ok) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'pdf' ? 'bulk_export.pdf' : 'bulk_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    alert('Export failed');
  }
}

async function downloadDocument(id) {
  window.open(`${documentsApiBaseUrl()}/documents/download/${id}`, '_blank');
}

async function exportDocuments() {
  window.open(`${documentsApiBaseUrl()}/documents/export`, '_blank');
}

async function editDocument(id) {
  const d = await (await fetch(`${documentsApiBaseUrl()}/documents/${id}`)).json();
  buildDocumentForm();
  document.getElementById('modal-title').textContent = 'Edit Document';
  document.getElementById('form-id').value = d.id;
  const f = document.getElementById('record-form');
  f.documentNumber.value = d.documentNumber;
  f.title.value = d.title;
  f.category.value = d.category;
  f.department.value = d.department || '';
  f.revision.value = d.revision;
  f.effectiveDate.value = d.effectiveDate ? d.effectiveDate.split('T')[0] : '';
  f.reviewDate.value = d.reviewDate ? d.reviewDate.split('T')[0] : '';
  f.status.value = d.status;
  f.owner.value = d.owner;
  document.getElementById('modal-overlay').classList.add('active');
}

async function deleteDocument(id) {
  if (confirm('Delete this document?')) {
    const res = await fetch(`${documentsApiBaseUrl()}/documents/${id}`, { method: 'DELETE' });
    if (res.ok) fetchDocuments();
  }
}

