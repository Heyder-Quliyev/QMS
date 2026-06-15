function renderDocumentVersionsList(versions) {
  const el = document.getElementById('document-versions-list');
  if (!el) return;
  if (!versions || versions.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">No versions found.</div>';
    return;
  }

  el.innerHTML = `
    <div class="panel" style="margin:0;">
      <div class="panel-header">
        <div class="panel-title">Revision History</div>
      </div>
      <div style="padding: 12px 14px;">
        ${versions.map(v => `
          <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--border);">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:13px; color:var(--text);">${escapeHtml(formatDocumentVersionLabel(v))}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                ${v.is_current ? 'Current document record' : `Snapshot: ${escapeHtml(formatAbsoluteTimestamp(v.snapshot_at))}`}
              </div>
              ${v.change_summary ? `<div style="font-size:12px; color:var(--text-muted); margin-top:8px; line-height:1.4;">${escapeHtml(v.change_summary)}</div>` : ''}
            </div>
            <div style="display:flex; gap:8px; align-items:flex-start; flex-shrink:0;">
              <button type="button" class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="setDocumentCompareSide('old', '${escapeHtml(v.id)}')">Set as Old</button>
              <button type="button" class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="setDocumentCompareSide('new', '${escapeHtml(v.id)}')">Set as New</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setDocumentCompareSide(side, versionId) {
  const select = document.getElementById(side === 'old' ? 'doc-compare-old' : 'doc-compare-new');
  if (!select) return;
  select.value = versionId;
}

async function loadDocumentHistory(documentId) {
  const oldSelect = document.getElementById('doc-compare-old');
  const newSelect = document.getElementById('doc-compare-new');
  const list = document.getElementById('document-versions-list');
  const result = document.getElementById('document-compare-result');
  if (list) list.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading versions...</div>';
  if (result) result.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/versions`);
    const data = await res.json();
    const versions = data?.versions || [];

    renderDocumentVersionsList(versions);

    if (oldSelect && newSelect) {
      oldSelect.innerHTML = versions.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(formatDocumentVersionLabel(v))}</option>`).join('');
      newSelect.innerHTML = versions.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(formatDocumentVersionLabel(v))}</option>`).join('');

      const current = versions.find(v => v.is_current) || versions[0];
      const previous = versions.find(v => !v.is_current) || versions[1];

      if (previous && current) {
        oldSelect.value = previous.id;
        newSelect.value = current.id;
      } else if (current) {
        oldSelect.value = current.id;
        newSelect.value = current.id;
      }
    }
  } catch (e) {
    if (list) list.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading versions.</div>';
  }
}

function renderDocumentCompareResult(compare) {
  const result = document.getElementById('document-compare-result');
  if (!result) return;
  if (!compare) {
    result.innerHTML = '';
    setDocumentCompareModalLayout(false);
    return;
  }

  const changedFields = (compare.changed_fields || []).filter(f => f && f.changed);
  const linesOld = compare?.diff_lines?.old || null;
  const linesNew = compare?.diff_lines?.new || null;
  const additions = compare.additions ?? null;
  const removals = compare.removals ?? null;

  const summary = `
    <div class="panel" style="margin:0;">
      <div class="panel-header">
        <div class="panel-title">Comparison</div>
        <div style="font-size:12px; color:var(--text-muted);">${additions != null && removals != null ? `+${additions} / -${removals}` : ''}</div>
      </div>
      <div style="padding: 12px 14px;">
        ${changedFields.length === 0 ? `<div style="color:var(--text-muted); font-size:13px;">No metadata changes.</div>` : `
          <div style="display:grid; grid-template-columns: 160px 1fr; gap:10px; align-items:start;">
            ${changedFields.map(f => `
              <div style="color:var(--text-muted); font-size:12px; text-transform:uppercase; letter-spacing:0.4px; font-weight:700;">${escapeHtml(f.field)}</div>
              <div style="font-size:13px; color:var(--text);">
                <span style="color:rgba(255,107,53,0.9); text-decoration:line-through;">${escapeHtml(f.old_value ?? '')}</span>
                <span style="color:var(--text-muted); padding:0 10px;">→</span>
                <span style="color:rgba(16,185,129,0.95);">${escapeHtml(f.new_value ?? '')}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  let diffHtml = '';
  if (Array.isArray(linesOld) && Array.isArray(linesNew) && linesOld.length === linesNew.length) {
    const maxLines = Math.min(linesOld.length, 1200);
    const buildLines = (lines) => lines.slice(0, maxLines).map((l, idx) => {
      const type = l?.type || 'same';
      const text = l?.text || '';
      return `<div class="diff-line ${escapeHtml(type)}"><div class="diff-lineno">${idx + 1}</div><div class="diff-text">${escapeHtml(text)}</div></div>`;
    }).join('');

    diffHtml = `
      <div class="diff-compare-grid">
        <div class="value-diff-panel value-diff-old">
          <div class="value-diff-header"><span>Old</span><span>${escapeHtml(formatDocumentVersionLabel(compare.old_document))}</span></div>
          <div class="diff-lines">${buildLines(linesOld)}</div>
        </div>
        <div class="value-diff-panel value-diff-new">
          <div class="value-diff-header"><span>New</span><span>${escapeHtml(formatDocumentVersionLabel(compare.new_document))}</span></div>
          <div class="diff-lines">${buildLines(linesNew)}</div>
        </div>
      </div>
    `;
  } else {
    diffHtml = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px; margin-top:12px;">No diff content available for these versions.</div>';
  }

  result.innerHTML = `${summary}${diffHtml}`;
  setDocumentCompareModalLayout(true);
}

async function compareSelectedDocumentVersions(documentId) {
  const oldSelect = document.getElementById('doc-compare-old');
  const newSelect = document.getElementById('doc-compare-new');
  const result = document.getElementById('document-compare-result');
  if (!oldSelect || !newSelect || !result) return;

  const oldId = oldSelect.value;
  const newId = newSelect.value;
  if (!oldId || !newId) return;

  result.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Comparing...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/documents/compare?old=${encodeURIComponent(oldId)}&new=${encodeURIComponent(newId)}`);
    const data = await res.json();
    renderDocumentCompareResult(data);
  } catch (e) {
    result.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error comparing versions.</div>';
  }
}
