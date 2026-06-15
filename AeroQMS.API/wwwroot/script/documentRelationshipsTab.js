window.__documentRelationshipUi = window.__documentRelationshipUi || { openFormForDocumentId: null, lookupCache: null, lookupCacheAt: 0 };

function relationshipTypeLabel(type) {
  const t = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (t === 'references') return 'References';
  if (t === 'supersedes') return 'Supersedes';
  if (t === 'related_to') return 'Related To';
  if (t === 'linked_ncr') return 'Linked NCR';
  if (t === 'linked_capa') return 'Linked CAPA';
  return type ? String(type) : 'Relationship';
}

function relationshipBadgeClass(type) {
  const t = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (t === 'references') return 'blue';
  if (t === 'supersedes') return 'blue';
  if (t === 'related_to') return 'gray';
  if (t === 'linked_ncr' || t === 'linked_capa') return 'orange';
  return 'gray';
}

async function getRelationshipLookupData() {
  const now = Date.now();
  const cache = window.__documentRelationshipUi.lookupCache;
  const cacheAt = window.__documentRelationshipUi.lookupCacheAt || 0;
  if (cache && (now - cacheAt) < 5 * 60 * 1000) return cache;

  const [docsRes, ncrRes, capaRes] = await Promise.all([
    fetch(`${API_BASE_URL}/documents?_=${now}`, { cache: 'no-store' }),
    fetch(`${API_BASE_URL}/ncr?_=${now}`, { cache: 'no-store' }),
    fetch(`${API_BASE_URL}/capa?_=${now}`, { cache: 'no-store' })
  ]);

  const docs = await docsRes.json().catch(() => []);
  const ncrs = await ncrRes.json().catch(() => []);
  const capas = await capaRes.json().catch(() => []);

  const normalized = {
    documents: Array.isArray(docs) ? docs : [],
    ncrs: Array.isArray(ncrs) ? ncrs : [],
    capas: Array.isArray(capas) ? capas : []
  };

  window.__documentRelationshipUi.lookupCache = normalized;
  window.__documentRelationshipUi.lookupCacheAt = now;
  return normalized;
}

function openAddRelationshipForm(documentId) {
  window.__documentRelationshipUi.openFormForDocumentId = documentId;
  loadDocumentRelationshipsTab(documentId);
}

function closeAddRelationshipForm(documentId) {
  if (window.__documentRelationshipUi.openFormForDocumentId === documentId) {
    window.__documentRelationshipUi.openFormForDocumentId = null;
  }
  loadDocumentRelationshipsTab(documentId);
}

function onRelationshipTypeChange() {
  const type = String(document.getElementById('rel-type')?.value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const docWrap = document.getElementById('rel-target-doc-wrap');
  const ncrWrap = document.getElementById('rel-target-ncr-wrap');
  const capaWrap = document.getElementById('rel-target-capa-wrap');
  if (docWrap) docWrap.style.display = (type === 'linked_ncr' || type === 'linked_capa') ? 'none' : 'block';
  if (ncrWrap) ncrWrap.style.display = (type === 'linked_ncr') ? 'block' : 'none';
  if (capaWrap) capaWrap.style.display = (type === 'linked_capa') ? 'block' : 'none';
}

function parseDatalistKey(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const idx = v.indexOf(' — ');
  return idx >= 0 ? v.slice(0, idx).trim() : v;
}

async function saveDocumentRelationship(documentId) {
  const type = String(document.getElementById('rel-type')?.value || '').trim().toLowerCase().replace(/\s+/g, '_');
  const note = (document.getElementById('rel-note')?.value || '').trim();

  let payload = { relationship_type: type, target_doc_id: null, target_ncr_id: null, target_capa_id: null, note: note || null };

  const lookups = await getRelationshipLookupData();

  if (type === 'linked_ncr') {
    const raw = document.getElementById('rel-target-ncr')?.value || '';
    const key = parseDatalistKey(raw);
    const n = lookups.ncrs.find(x => String(x.ncrNumber || x.NCRNumber || '').trim() === key);
    if (!n || n.id == null) {
      showToast('Please select a valid NCR from the list.', 'error');
      return;
    }
    payload.target_ncr_id = n.id;
  } else if (type === 'linked_capa') {
    const raw = document.getElementById('rel-target-capa')?.value || '';
    const key = parseDatalistKey(raw);
    const c = lookups.capas.find(x => String(x.id || '').trim() === key);
    if (!c || !c.id) {
      showToast('Please select a valid CAPA from the list.', 'error');
      return;
    }
    payload.target_capa_id = c.id;
  } else {
    const raw = document.getElementById('rel-target-doc')?.value || '';
    const key = parseDatalistKey(raw);
    const d = lookups.documents.find(x => String(x.documentNumber || '').trim() === key);
    if (!d || d.id == null) {
      showToast('Please select a valid target document from the list.', 'error');
      return;
    }
    payload.target_doc_id = d.id;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/relationships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(String(data?.error || 'Unable to save relationship.'), 'error');
      return;
    }
    showToast('Relationship saved.', 'success');
    window.__documentRelationshipUi.openFormForDocumentId = null;
    await loadDocumentRelationshipsTab(documentId);
  } catch {
    showToast('Unable to save relationship.', 'error');
  }
}

async function deleteDocumentRelationship(documentId, relId) {
  if (!documentId || !relId) return;
  if (!confirm('Delete this relationship?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/relationships/${relId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(String(data?.error || 'Unable to delete relationship.'), 'error');
      return;
    }
    showToast('Relationship deleted.', 'success');
    await loadDocumentRelationshipsTab(documentId);
  } catch {
    showToast('Unable to delete relationship.', 'error');
  }
}

async function loadDocumentRelationshipsTab(documentId) {
  const el = document.getElementById('document-relationships-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading relationships...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/relationships?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || 'Failed');

    const rels = Array.isArray(data.relationships) ? data.relationships : [];
    const openForm = window.__documentRelationshipUi.openFormForDocumentId === documentId;

    let formHtml = '';
    if (openForm) {
      const lookups = await getRelationshipLookupData();
      const docOptions = (lookups.documents || [])
        .slice()
        .sort((a, b) => String(a.documentNumber || '').localeCompare(String(b.documentNumber || '')))
        .map(d => `<option value="${escapeHtml(String(d.documentNumber || ''))} — ${escapeHtml(String(d.title || ''))}"></option>`)
        .join('');
      const ncrOptions = (lookups.ncrs || [])
        .slice()
        .sort((a, b) => String(a.ncrNumber || a.NCRNumber || '').localeCompare(String(b.ncrNumber || b.NCRNumber || '')))
        .map(n => `<option value="${escapeHtml(String(n.ncrNumber || n.NCRNumber || ''))} — ${escapeHtml(String(n.title || ''))}"></option>`)
        .join('');
      const capaOptions = (lookups.capas || [])
        .slice()
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
        .map(c => `<option value="${escapeHtml(String(c.id || ''))} — ${escapeHtml(String(c.title || ''))}"></option>`)
        .join('');

      formHtml = `
        <div class="panel" style="margin: 14px 0 0;">
          <div class="panel-header" style="justify-content: space-between; gap: 10px;">
            <span class="panel-title" style="font-size: 14px;">Add Relationship</span>
            <button type="button" class="btn btn-ghost" onclick="closeAddRelationshipForm(${documentId})">Cancel</button>
          </div>
          <div class="panel-body" style="padding: 14px;">
            <div class="form-group" style="margin:0 0 12px;">
              <label class="form-label">Relationship Type</label>
              <select id="rel-type" class="form-input" onchange="onRelationshipTypeChange()">
                <option value="references">References</option>
                <option value="supersedes">Supersedes</option>
                <option value="related_to">Related To</option>
                <option value="linked_ncr">Linked NCR</option>
                <option value="linked_capa">Linked CAPA</option>
              </select>
            </div>

            <div class="form-group" id="rel-target-doc-wrap" style="margin:0 0 12px;">
              <label class="form-label">Target Document</label>
              <input id="rel-target-doc" class="form-input" list="rel-docs-datalist" placeholder="Search by doc number or title..." autocomplete="off">
              <datalist id="rel-docs-datalist">${docOptions}</datalist>
            </div>

            <div class="form-group" id="rel-target-ncr-wrap" style="margin:0 0 12px; display:none;">
              <label class="form-label">Target NCR</label>
              <input id="rel-target-ncr" class="form-input" list="rel-ncrs-datalist" placeholder="Search NCR..." autocomplete="off">
              <datalist id="rel-ncrs-datalist">${ncrOptions}</datalist>
            </div>

            <div class="form-group" id="rel-target-capa-wrap" style="margin:0 0 12px; display:none;">
              <label class="form-label">Target CAPA</label>
              <input id="rel-target-capa" class="form-input" list="rel-capas-datalist" placeholder="Search CAPA..." autocomplete="off">
              <datalist id="rel-capas-datalist">${capaOptions}</datalist>
            </div>

            <div class="form-group" style="margin:0 0 12px;">
              <label class="form-label">Note (optional)</label>
              <textarea id="rel-note" class="form-input" rows="3" placeholder="Short description of why they are related..."></textarea>
            </div>

            <button type="button" class="btn btn-primary" onclick="saveDocumentRelationship(${documentId})" style="justify-content:center;">Save</button>
          </div>
        </div>
      `;
    }

    const listHtml = rels.length
      ? rels.map(r => {
          const type = String(r.relationship_type || '');
          const badge = relationshipBadgeClass(type);
          let targetLine = '';
          if (r.target_kind === 'document') targetLine = `${escapeHtml(String(r.target_doc_number || ''))} - ${escapeHtml(String(r.target_title || ''))}`;
          else if (r.target_kind === 'ncr') targetLine = `${escapeHtml(String(r.target_ncr_number || ''))} - ${escapeHtml(String(r.target_title || ''))}`;
          else if (r.target_kind === 'capa') targetLine = `${escapeHtml(String(r.target_capa_number || ''))} - ${escapeHtml(String(r.target_title || ''))}`;
          else targetLine = escapeHtml(String(r.target_title || ''));

          const noteLine = (r.note && String(r.note).trim())
            ? `<div style="color:var(--text-muted); font-size:12px; margin-top:6px;">Note: ${escapeHtml(String(r.note))}</div>`
            : '';

          return `
            <div style="border:1px solid var(--border); border-radius: 12px; padding: 12px; background: rgba(255,255,255,0.02); display:flex; gap:12px; align-items:flex-start; justify-content:space-between; margin-bottom: 10px;">
              <div style="min-width:0;">
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                  <span class="badge badge-${badge}">${escapeHtml(relationshipTypeLabel(type))}</span>
                  <div style="font-weight:800; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 560px;" title="${escapeHtml(targetLine)}">${targetLine}</div>
                </div>
                ${noteLine}
              </div>
              <button type="button" class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="deleteDocumentRelationship(${documentId}, '${escapeHtml(String(r.id || ''))}')">Delete</button>
            </div>
          `;
        }).join('')
      : `<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">No relationships defined yet.</div>`;

    el.innerHTML = `
      <div>
        ${listHtml}
        <div style="display:flex; justify-content:flex-end; margin-top: 10px;">
          <button type="button" class="btn btn-primary" onclick="openAddRelationshipForm(${documentId})">+ Add Relationship</button>
        </div>
        ${formHtml}
      </div>
    `;
  } catch {
    el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading relationships.</div>';
  }
}
