function buildDocumentShortUrl(documentId) {
  return `${window.location.origin}/d/${documentId}`;
}

function getQrServiceUrl(shortUrl, format = 'svg', size = 256) {
  const f = (format || 'svg').toLowerCase();
  const s = parseInt(size, 10) || 256;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${encodeURIComponent(`${s}x${s}`)}&format=${encodeURIComponent(f)}&data=${encodeURIComponent(shortUrl)}`;
}

async function trackDocumentAccess(documentId, source = 'qr') {
  try {
    await fetch(`${API_BASE_URL}/documents/${documentId}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ source, device: navigator.userAgent })
    });
  } catch {
  }
}

async function loadDocumentQrAccess(documentId) {
  const el = document.getElementById('document-qr-content');
  if (!el) return;

  const d = window.currentDocumentInfo || {};
  const shortUrl = buildDocumentShortUrl(documentId);
  const svgUrl = getQrServiceUrl(shortUrl, 'svg', 256);

  el.innerHTML = `
    <div class="qr-access-layout">
      <div class="qr-access-left">
        <div class="panel" style="margin:0;">
          <div class="panel-header"><span class="panel-title">QR Access</span></div>
          <div class="panel-body" style="padding: 16px;">
            <div id="doc-qr-code" style="display:flex; justify-content:center; padding: 10px; background: #fff; border-radius: 10px;">
            </div>
            <div style="display:flex; gap:10px; margin-top: 12px; flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost" onclick="downloadQR('png')">Download PNG</button>
              <button type="button" class="btn btn-ghost" onclick="downloadQR('pdf')">Download PDF</button>
              <button type="button" class="btn btn-ghost" onclick="printQR()">Print Label</button>
            </div>
            <div style="margin-top: 12px; color: var(--text-muted); font-size: 12px;">Scan to access latest version of this document</div>
            <div style="display:flex; gap:10px; align-items:center; margin-top: 10px;">
              <code id="doc-qr-url" style="flex:1; overflow:auto; padding: 8px 10px; border:1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,0.02);">${escapeHtml(shortUrl)}</code>
              <button type="button" class="btn btn-ghost" style="padding: 8px 10px;" onclick="copyUrl()">Copy</button>
            </div>
          </div>
        </div>
      </div>

      <div class="qr-access-right">
        <div class="panel" style="margin:0;">
          <div class="panel-header"><span class="panel-title">Document Access Statistics</span></div>
          <div class="panel-body" style="padding: 16px;">
            <div style="display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
              <div style="padding: 12px; border:1px solid var(--border); border-radius: 12px;">
                <div id="qr-stat-total" style="font-size: 22px; font-weight: 900;">-</div>
                <div style="color: var(--text-muted); font-size: 12px;">Total Scans</div>
              </div>
              <div style="padding: 12px; border:1px solid var(--border); border-radius: 12px;">
                <div id="qr-stat-month" style="font-size: 22px; font-weight: 900;">-</div>
                <div style="color: var(--text-muted); font-size: 12px;">This Month</div>
              </div>
              <div style="padding: 12px; border:1px solid var(--border); border-radius: 12px;">
                <div id="qr-stat-unique" style="font-size: 22px; font-weight: 900;">-</div>
                <div style="color: var(--text-muted); font-size: 12px;">Unique Users</div>
              </div>
            </div>

            <div style="margin-top: 14px;">
              <canvas id="scan-history-chart" height="80" style="width:100%;"></canvas>
            </div>

            <div style="margin-top: 14px; font-weight: 900;">Recent Scans</div>
            <div id="qr-recent-scans" style="margin-top: 10px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const codeEl = document.getElementById('doc-qr-code');
    if (codeEl) {
      codeEl.textContent = '';
      const img = document.createElement('img');
      img.alt = 'Document QR Code';
      img.style.width = '256px';
      img.style.height = '256px';
      img.src = svgUrl;
      codeEl.appendChild(img);
    }
  } catch {
  }

  await loadDocumentAccessStats(documentId);
}

async function loadDocumentAccessStats(documentId) {
  const totalEl = document.getElementById('qr-stat-total');
  const monthEl = document.getElementById('qr-stat-month');
  const uniqueEl = document.getElementById('qr-stat-unique');
  const recentEl = document.getElementById('qr-recent-scans');
  const canvas = document.getElementById('scan-history-chart');

  if (recentEl) recentEl.innerHTML = '<div style="color:var(--text-muted); font-size: 12px;">Loading...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/access/stats?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed');

    const stats = data?.stats || {};
    if (totalEl) totalEl.textContent = String(stats.total_scans ?? 0);
    if (monthEl) monthEl.textContent = String(stats.scans_this_month ?? 0);
    if (uniqueEl) uniqueEl.textContent = String(stats.unique_users ?? 0);

    const recent = data?.recent_scans || [];
    if (recentEl) {
      if (!recent || recent.length === 0) {
        recentEl.innerHTML = '<div style="color:var(--text-muted); font-size: 12px;">No scans recorded.</div>';
      } else {
        recentEl.innerHTML = recent.map(s => {
          const name = s.user_name || s.user_email || 'User';
          const when = s.accessed_at ? new Date(s.accessed_at).toLocaleString() : '';
          const device = (s.device || '').toString();
          const deviceShort = device.length > 40 ? device.slice(0, 40) + '…' : device;
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding: 10px 0; border-bottom:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                <div class="avatar-xs">${escapeHtml(initialsFromName(name))}</div>
                <div style="min-width:0;">
                  <div style="font-weight:800; font-size: 13px;">${escapeHtml(name)}</div>
                  <div style="color:var(--text-muted); font-size: 11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(deviceShort)}</div>
                </div>
              </div>
              <div style="color:var(--text-muted); font-size: 11px; white-space:nowrap;">${escapeHtml(when)}</div>
            </div>
          `;
        }).join('');
      }
    }

    const history = data?.history || [];
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      const w = canvas.clientWidth || 600;
      const h = canvas.height || 80;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      const points = (history || []).map(x => parseInt(x.count, 10) || 0);
      const max = Math.max(1, ...points);
      const pad = 6;
      ctx.strokeStyle = 'rgba(59,139,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((v, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
        const y = h - pad - (v * (h - pad * 2)) / max;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, h - pad);
      ctx.lineTo(w - pad, h - pad);
      ctx.stroke();
    }
  } catch {
    if (recentEl) recentEl.innerHTML = '<div style="color:var(--accent3); font-size: 12px;">Error loading stats.</div>';
  }
}

async function downloadQR(format) {
  const d = window.currentDocumentInfo || {};
  const documentId = d.id;
  if (!documentId) return;

  const shortUrl = buildDocumentShortUrl(documentId);
  if (format === 'pdf') {
    window.open(`${API_BASE_URL}/documents/${documentId}/qr-label`, '_blank');
    return;
  }

  const pngUrl = getQrServiceUrl(shortUrl, 'png', 512);
  try {
    const res = await fetch(pngUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(d.documentNumber || 'document')}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    window.open(pngUrl, '_blank');
  }
}

function printQR() {
  try {
    const d = window.currentDocumentInfo || {};
    const documentId = d.id;
    const docNumber = (d.documentNumber || '').toString().trim();
    const docTitle = (d.title || '').toString().trim();
    if (!documentId || !docNumber) {
      showToast('QR label unavailable: missing document data', 'error');
      return;
    }

    const shortUrl = buildDocumentShortUrl(documentId);
    const qrUrl = getQrServiceUrl(shortUrl, 'png', 320);
    if (!qrUrl) {
      showToast('QR label unavailable: QR URL not available', 'error');
      return;
    }

    const w = window.open('', '_blank');
    if (!w) {
      showToast('Popup blocked. Please allow popups to print.', 'error');
      return;
    }

    const doc = w.document;
    doc.title = 'Document QR Label';
    while (doc.head.firstChild) doc.head.removeChild(doc.head.firstChild);
    while (doc.body.firstChild) doc.body.removeChild(doc.body.firstChild);

    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    doc.head.appendChild(meta);

    const style = doc.createElement('style');
    style.textContent = 'body{font-family:Arial;text-align:center;padding:20px}.label{border:2px solid #000;padding:20px;display:inline-block}.doc-number{font-size:22px;font-weight:bold}.doc-title{font-size:12px;margin:8px 0;max-width:320px}img{width:200px;height:200px}';
    doc.head.appendChild(style);

    const label = doc.createElement('div');
    label.className = 'label';

    const dn = doc.createElement('div');
    dn.className = 'doc-number';
    dn.textContent = docNumber;

    const dt = doc.createElement('div');
    dt.className = 'doc-title';
    dt.textContent = docTitle;

    const img = doc.createElement('img');
    img.src = qrUrl;
    img.alt = 'QR';

    const caption = doc.createElement('div');
    caption.textContent = 'Scan for latest version';

    label.appendChild(dn);
    if (docTitle) label.appendChild(dt);
    label.appendChild(img);
    label.appendChild(caption);
    doc.body.appendChild(label);

    img.onload = () => {
      try { w.focus(); } catch {}
      try { w.print(); } catch {}
    };
    img.onerror = () => {
      showToast('QR label unavailable: failed to load QR image', 'error');
      try { w.close(); } catch {}
    };
  } catch {
    showToast('QR label unavailable', 'error');
  }
}

async function copyUrl() {
  const d = window.currentDocumentInfo || {};
  const documentId = d.id;
  if (!documentId) return;
  const shortUrl = buildDocumentShortUrl(documentId);
  try {
    await navigator.clipboard.writeText(shortUrl);
    showToast('Copied', 'success');
  } catch {
    showToast('Copy failed', 'error');
  }
}
