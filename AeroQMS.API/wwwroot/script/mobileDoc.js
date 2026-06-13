function mobileDocDeps() {
  return window.__mobileDocDeps || {};
}

function mobileDocApiBaseUrl() {
  return mobileDocDeps().API_BASE_URL || '/api';
}

function mobileDocEscapeHtml(value) {
  const fn = mobileDocDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function mobileDocGetStatusBadge(status) {
  const fn = mobileDocDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function mobileDocShowPage(id, el) {
  const fn = mobileDocDeps().showPage;
  if (typeof fn === 'function') return fn(id, el);
}

function mobileDocShowToast(message, type) {
  const fn = mobileDocDeps().showToast;
  if (typeof fn === 'function') fn(message, type);
}

function mobileDocTrackDocumentAccess(documentId, source) {
  const fn = mobileDocDeps().trackDocumentAccess;
  if (typeof fn === 'function') return fn(documentId, source);
}

function mobileDocBuildDocumentShortUrl(documentId) {
  const fn = mobileDocDeps().buildDocumentShortUrl;
  if (typeof fn === 'function') return fn(documentId);
  return window.location.origin + '/d/' + documentId;
}

async function loadMobileDocView() {
  const root = document.getElementById('mobile-doc-root');
  const documentId = window.mobileDocId;
  if (!root) return;
  if (!documentId) {
    root.textContent = '';
    const msg = document.createElement('div');
    msg.style.padding = '24px';
    msg.style.color = 'var(--text-muted)';
    msg.textContent = 'Document not found.';
    root.appendChild(msg);
    return;
  }

  root.textContent = '';
  const loading = document.createElement('div');
  loading.style.padding = '24px';
  loading.style.color = 'var(--text-muted)';
  loading.textContent = 'Loading...';
  root.appendChild(loading);

  try {
    await mobileDocTrackDocumentAccess(documentId, 'qr');
    const res = await fetch(`${mobileDocApiBaseUrl()}/documents/${documentId}?_=${Date.now()}`, { cache: 'no-store' });
    const d = await res.json().catch(() => null);
    if (!res.ok || !d) throw new Error('Failed');

    const status = d.status || '';
    root.textContent = '';

    const topbar = document.createElement('div');
    topbar.style.padding = '12px 14px';
    topbar.style.borderBottom = '1px solid var(--border)';
    topbar.style.display = 'flex';
    topbar.style.alignItems = 'center';
    topbar.style.justifyContent = 'space-between';
    topbar.style.gap = '12px';

    const info = document.createElement('div');
    info.style.minWidth = '0';
    const num = document.createElement('div');
    num.style.fontWeight = '900';
    num.style.fontSize = '14px';
    num.style.whiteSpace = 'nowrap';
    num.style.overflow = 'hidden';
    num.style.textOverflow = 'ellipsis';
    num.textContent = (d.documentNumber || '').toString();
    const rev = document.createElement('div');
    rev.style.color = 'var(--text-muted)';
    rev.style.fontSize = '12px';
    rev.textContent = (d.revision || '').toString();
    info.appendChild(num);
    info.appendChild(rev);

    const badge = document.createElement('span');
    badge.className = `badge badge-${mobileDocGetStatusBadge(status)}`;
    badge.textContent = (status || '').toString();

    topbar.appendChild(info);
    topbar.appendChild(badge);

    const body = document.createElement('div');
    body.style.padding = '12px 14px';

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.marginBottom = '8px';
    title.textContent = (d.title || '').toString();

    const eff = document.createElement('div');
    eff.style.color = 'var(--text-muted)';
    eff.style.fontSize = '12px';
    eff.style.marginBottom = '12px';
    eff.textContent = `Effective: ${d.effectiveDate ? new Date(d.effectiveDate).toLocaleDateString() : '-'}`;

    const frameWrap = document.createElement('div');
    frameWrap.style.border = '1px solid var(--border)';
    frameWrap.style.borderRadius = '12px';
    frameWrap.style.overflow = 'hidden';
    frameWrap.style.background = 'rgba(255,255,255,0.02)';

    const iframe = document.createElement('iframe');
    iframe.src = `${mobileDocApiBaseUrl()}/documents/view/${documentId}`;
    iframe.style.width = '100%';
    iframe.style.height = '65vh';
    iframe.style.border = '0';
    frameWrap.appendChild(iframe);

    body.appendChild(title);
    body.appendChild(eff);
    body.appendChild(frameWrap);

    const actions = document.createElement('div');
    actions.style.position = 'sticky';
    actions.style.bottom = '0';
    actions.style.background = 'rgba(10,22,40,0.95)';
    actions.style.borderTop = '1px solid var(--border)';
    actions.style.padding = '10px 14px';
    actions.style.display = 'flex';
    actions.style.gap = '10px';

    const btnIssue = document.createElement('button');
    btnIssue.type = 'button';
    btnIssue.className = 'btn btn-ghost';
    btnIssue.style.flex = '1';
    btnIssue.style.justifyContent = 'center';
    btnIssue.textContent = 'Report Issue';
    btnIssue.addEventListener('click', () => reportIssue(documentId));

    const btnDownload = document.createElement('button');
    btnDownload.type = 'button';
    btnDownload.className = 'btn btn-ghost';
    btnDownload.style.flex = '1';
    btnDownload.style.justifyContent = 'center';
    btnDownload.textContent = 'Download';
    btnDownload.addEventListener('click', () => downloadDoc(documentId));

    const btnShare = document.createElement('button');
    btnShare.type = 'button';
    btnShare.className = 'btn btn-primary';
    btnShare.style.flex = '1';
    btnShare.style.justifyContent = 'center';
    btnShare.textContent = 'Share';
    btnShare.addEventListener('click', () => shareDoc(documentId));

    actions.appendChild(btnIssue);
    actions.appendChild(btnDownload);
    actions.appendChild(btnShare);

    root.appendChild(topbar);
    root.appendChild(body);
    root.appendChild(actions);
  } catch {
    root.textContent = '';
    const msg = document.createElement('div');
    msg.style.padding = '24px';
    msg.style.color = 'var(--accent3)';
    msg.textContent = 'Error loading document.';
    root.appendChild(msg);
  }
}

async function reportIssue(documentId) {
  await mobileDocShowPage('ncr', null);
  mobileDocShowToast(`Create an NCR for DOC ID ${documentId}`, 'success');
}

function downloadDoc(documentId) {
  window.open(`${mobileDocApiBaseUrl()}/documents/download/${documentId}`, '_blank');
}

async function shareDoc(documentId) {
  const url = mobileDocBuildDocumentShortUrl(documentId);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Document', url });
      return;
    }
  } catch {
  }
  try {
    await navigator.clipboard.writeText(url);
    mobileDocShowToast('Copied', 'success');
  } catch {
    mobileDocShowToast('Copy failed', 'error');
  }
}
