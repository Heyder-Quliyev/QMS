function myDocumentsDeps() {
  return window.__myDocumentsDeps || {};
}

function myDocumentsApiBaseUrl() {
  return myDocumentsDeps().API_BASE_URL || '/api';
}

function myDocumentsEscapeHtml(value) {
  const fn = myDocumentsDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

async function myDocumentsRefreshAckNavBadge() {
  const fn = myDocumentsDeps().refreshAckNavBadge;
  if (typeof fn === 'function') {
    await fn();
  }
}

async function loadMyDocuments() {
  const list = document.getElementById('my-documents-list');
  const alertWrap = document.getElementById('my-documents-alert');
  const alertText = document.getElementById('my-documents-alert-text');
  if (list) list.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading...</div>';

  try {
    const res = await fetch(`${myDocumentsApiBaseUrl()}/documents/my-documents?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json().catch(() => null);
    const docs = data?.documents || [];
    const count = data?.count ?? (docs?.length || 0);

    if (alertWrap && alertText) {
      alertWrap.style.display = count > 0 ? 'flex' : 'none';
      alertText.textContent = `${count} Document${count === 1 ? '' : 's'} require your acknowledgment`;
    }

    if (list) {
      if (!docs || docs.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">No pending acknowledgments.</div>';
      } else {
        list.innerHTML = docs.map(d => `
          <div class="doc-ack-card">
            <div class="doc-ack-info" style="min-width:0;">
              <div class="doc-ack-number">${myDocumentsEscapeHtml(d.document_number || '')}</div>
              <h4>${myDocumentsEscapeHtml(d.title || '')}</h4>
              <p>Revision ${myDocumentsEscapeHtml(d.revision || '')} • Due: ${d.due_date ? new Date(d.due_date).toLocaleDateString() : '-'}</p>
            </div>
            <div class="doc-ack-actions">
              <button class="btn btn-ghost" onclick="viewDocument(${d.id})">View Document</button>
              <button type="button" class="btn btn-primary" onclick='openAckConfirmModal(${d.id}, ${JSON.stringify(d.title || '')}, ${JSON.stringify(d.revision || '')})'>I Have Read &amp; Understood</button>
            </div>
          </div>
        `).join('');
      }
    }

    await myDocumentsRefreshAckNavBadge();
  } catch {
    if (list) list.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading documents.</div>';
  }
}

