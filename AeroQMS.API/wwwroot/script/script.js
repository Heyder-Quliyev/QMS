const API_BASE_URL = '/api';
const pageTitles = { dashboard:'Dashboard', audits:'Audit Management', documents:'Document Control', 'documents-analytics':'Document Analytics', 'relationship-map':'Document Relationship Map', ncr:'Non-Conformance Reports', capa:'CAPA Management', checklists:'Checklists', training:'Training Records', risk:'Risk Management', suppliers:'Supplier Management', settings:'Settings', users:'Users', 'my-actions':'My Actions', 'my-reviews':'My Review Tasks', 'my-documents':'My Documents', 'mobile-doc':'Document', 'capa-analytics':'CAPA Analytics' };

const originalFetch = window.fetch.bind(window);
let __redirectingToLogin = false;
window.fetch = async (...args) => {
  const res = await originalFetch(...args);
  if (res && res.status === 401) {
    if (!__redirectingToLogin && window.location.pathname !== '/login') {
      __redirectingToLogin = true;
      window.location.href = '/login';
    }
  }
  return res;
};

function showLoginView() {
  const loginRoot = document.getElementById('login-root');
  const app = document.querySelector('.app-container');
  if (loginRoot) loginRoot.style.display = 'flex';
  if (app) app.style.display = 'none';
}

function showAppView() {
  const loginRoot = document.getElementById('login-root');
  const app = document.querySelector('.app-container');
  if (loginRoot) loginRoot.style.display = 'none';
  if (app) app.style.display = '';
}

function setLoginErrorVisible(visible) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.style.display = visible ? 'block' : 'none';
}

function setCurrentUser(user) {
  if (!user) {
    window.CURRENT_USER = null;
    sessionStorage.removeItem('CURRENT_USER');
    return;
  }
  window.CURRENT_USER = {
    Id: user.id,
    Name: user.name,
    Email: user.email,
    Role: user.role
  };
  sessionStorage.setItem('CURRENT_USER', JSON.stringify(window.CURRENT_USER));
}

function loadCurrentUserFromSession() {
  try {
    const raw = sessionStorage.getItem('CURRENT_USER');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.Id) return null;
    window.CURRENT_USER = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function isAdminUser() {
  const role = (window.CURRENT_USER?.Role || '').toLowerCase();
  return role.includes('admin');
}

function updateHeaderUser() {
  const wrap = document.getElementById('header-user');
  if (!wrap) return;
  if (!window.CURRENT_USER) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  const initialsEl = document.getElementById('header-user-initials');
  const nameEl = document.getElementById('header-user-name');
  const roleEl = document.getElementById('header-user-role');
  const name = window.CURRENT_USER.Name || '';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'U';
  if (initialsEl) initialsEl.textContent = initials;
  if (nameEl) nameEl.textContent = name || window.CURRENT_USER.Email || 'User';
  if (roleEl) roleEl.textContent = window.CURRENT_USER.Role || '';

  const usersNav = document.getElementById('nav-users');
  const usersAddBtn = document.getElementById('users-add-btn');
  if (usersNav) usersNav.style.display = isAdminUser() ? '' : 'none';
  if (usersAddBtn) usersAddBtn.style.display = isAdminUser() ? '' : 'none';
}

async function submitLogin() {
  setLoginErrorVisible(false);
  const email = (document.getElementById('login-email')?.value || '').trim();
  const password = document.getElementById('login-password')?.value || '';
  const rememberMe = !!document.getElementById('login-remember')?.checked;

  if (!email || !password) {
    setLoginErrorVisible(true);
    return;
  }

  try {
    setButtonLoading('login-submit', true, 'Signing in...');
    const res = await originalFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.user) {
      setLoginErrorVisible(true);
      return;
    }
    setCurrentUser(data.user);
    updateHeaderUser();
    window.location.href = '/';
  } catch {
    setLoginErrorVisible(true);
  } finally {
    setButtonLoading('login-submit', false);
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
  } catch {}
  setCurrentUser(null);
  window.location.href = '/login';
}

async function ensureAuthenticated() {
  const cached = loadCurrentUserFromSession();
  if (cached) {
    updateHeaderUser();
    refreshAckNavBadge();
  }

  try {
    const res = await originalFetch(`${API_BASE_URL}/auth/me?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data?.user) return false;
    setCurrentUser(data.user);
    updateHeaderUser();
    refreshAckNavBadge();
    return true;
  } catch {
    return false;
  }
}

function toggleNavGroup(el, id) {
  const subList = document.getElementById('sub-' + id);
  const icon = el.querySelector('svg:last-child');
  const isActive = subList.classList.contains('active');
  
  // Close all other sublists
  document.querySelectorAll('.nav-sub-list').forEach(list => list.classList.remove('active'));
  document.querySelectorAll('.nav-item svg:last-child').forEach(i => { if(i.style.transform) i.style.transform = 'rotate(0deg)'; });

  if (!isActive) {
    subList.classList.add('active');
    icon.style.transform = 'rotate(180deg)';
  } else {
    subList.classList.remove('active');
    icon.style.transform = 'rotate(0deg)';
  }
}

async function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .nav-sub-item').forEach(n => n.classList.remove('active'));
  
  const pageEl = document.getElementById('page-' + id);
  if (pageEl) pageEl.classList.add('active');
  
  document.getElementById('page-title').textContent = pageTitles[id] || id;

  const currentPath = window.location.pathname || '/';
  if (id === 'users') {
    if (currentPath !== '/settings/users') history.pushState({}, '', '/settings/users');
  } else if (id === 'documents-analytics') {
    if (currentPath !== '/documents/analytics') history.pushState({}, '', '/documents/analytics');
  } else if (id === 'relationship-map') {
    if (currentPath !== '/documents/relationship-map') history.pushState({}, '', '/documents/relationship-map');
  } else if (id === 'my-reviews') {
    if (currentPath !== '/my-reviews') history.pushState({}, '', '/my-reviews');
  } else if (id === 'my-documents') {
    if (currentPath !== '/my-documents') history.pushState({}, '', '/my-documents');
  } else if (id === 'mobile-doc') {
    const docId = window.mobileDocId;
    if (docId && currentPath !== `/d/${docId}`) history.pushState({}, '', `/d/${docId}`);
  } else if (currentPath === '/settings/users') {
    history.pushState({}, '', '/');
  } else if (currentPath === '/my-reviews') {
    history.pushState({}, '', '/');
  } else if (currentPath === '/my-documents') {
    history.pushState({}, '', '/');
  } else if (currentPath.startsWith('/d/')) {
    history.pushState({}, '', '/');
  } else if (currentPath === '/documents/relationship-map') {
    history.pushState({}, '', '/');
  } else if (currentPath === '/documents/analytics') {
    history.pushState({}, '', '/');
  }
  
  if (btn) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.nav-item, .nav-sub-item').forEach(n => { 
      if (n.textContent.trim().toLowerCase().includes(pageTitles[id].toLowerCase().split(' ')[0])) n.classList.add('active'); 
    });
  }

  // Ensure dashboard loads even if not triggered by switch
  if (id === 'dashboard') {
    loadCapaDashboard();
  }

  switch(id) {
    case 'dashboard': await loadCapaDashboard(); break;
    case 'audits': await fetchAudits(); break;
    case 'documents': await fetchDocuments(); break;
    case 'documents-analytics': await loadDocumentAnalytics(); break;
    case 'relationship-map': await initRelationshipMap(); break;
    case 'ncr': await fetchNcrs(); break;
    case 'training': await fetchTraining(); break;
    case 'risk': await fetchRisks(); break;
    case 'suppliers': await fetchSuppliers(); break;
    case 'checklists': await fetchChecklists(); break;
    case 'capa': await fetchCapas(); break;
    case 'my-actions': await loadMyActions(); break;
    case 'my-reviews': await loadMyReviewTasks(); break;
    case 'my-documents': await loadMyDocuments(); break;
    case 'mobile-doc': await loadMobileDocView(); break;
    case 'capa-analytics': await loadCapaAnalytics(); break;
    case 'users': await fetchUsersAdmin(); break;
    case 'settings': await loadAutomationSettings(); break;
  }
}

function routeToInitialPage() {
  const path = window.location.pathname || '/';
  if (path === '/settings/users') return 'users';
  if (path === '/documents/analytics') return 'documents-analytics';
  if (path === '/documents/relationship-map') return 'relationship-map';
  if (path === '/my-reviews') return 'my-reviews';
  if (path === '/my-documents') return 'my-documents';
  const dMatch = path.match(/^\/d\/(\d+)(?:\/)?$/);
  if (dMatch) {
    window.mobileDocId = parseInt(dMatch[1], 10);
    return 'mobile-doc';
  }
  return 'dashboard';
}

window.__documentRelationshipMapDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get showToast() { return showToast; },
  get viewDocument() { return viewDocument; },
  get getStatusBadge() { return getStatusBadge; }
};

// Analitics section

window.__documentAnalyticsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get getStatusBadge() { return getStatusBadge; },
  get initialsFromName() { return initialsFromName; },
  get startReview() { return startReview; }
};

window.__auditsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; },
  get showPage() { return showPage; },
  setCurrentFormType(value) { currentFormType = value; }
};

window.__nonConformanceReportsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; },
  get getSeverityBadge() { return getSeverityBadge; },
  get formatTimeAgo() { return formatTimeAgo; },
  get setActiveTabButton() { return setActiveTabButton; },
  setCurrentFormType(value) { currentFormType = value; }
};

window.__trainingRecordsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; }
};

window.__riskManagementDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getRiskBadge() { return getRiskBadge; }
};

window.__checkListsDeps = {
  get API_BASE_URL() { return API_BASE_URL; }
};

window.__myDocumentsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get refreshAckNavBadge() { return refreshAckNavBadge; }
};

window.__myReviewTasksDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get showPage() { return showPage; },
  get viewDocument() { return viewDocument; }
};

window.__usersDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get isAdminUser() { return isAdminUser; },
  get showToast() { return showToast; },
  get closeModal() { return closeModal; },
  get submitRecord() { return submitRecord; }
};

window.__mobileDocDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get getStatusBadge() { return getStatusBadge; },
  get showPage() { return showPage; },
  get showToast() { return showToast; },
  get trackDocumentAccess() { return trackDocumentAccess; },
  get buildDocumentShortUrl() { return buildDocumentShortUrl; }
};

window.__dashboardDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get viewCapa() { return window.viewCapa; }
};

window.__supplierManagementDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; }
};

window.__settingsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get showToast() { return showToast; }
};

window.__myActionsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get escapeHtml() { return escapeHtml; },
  get getPriorityBadge() { return getPriorityBadge; },
  get getStatusBadge() { return getStatusBadge; },
  get viewCapa() { return window.viewCapa; },
  get viewNCR() { return window.viewNCR; },
  get showToast() { return showToast; },
  get fetchCapas() { return window.fetchCapas; },
  get fetchMyActions() { return typeof fetchMyActions === 'function' ? fetchMyActions : undefined; }
};

window.__documentsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; },
  get viewDocument() { return viewDocument; }
};

window.__capaAnalyticsDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; }
};

window.__capaManagementDeps = {
  get API_BASE_URL() { return API_BASE_URL; },
  get getStatusBadge() { return getStatusBadge; },
  get getPriorityBadge() { return getPriorityBadge; },
  get showToast() { return showToast; },
  get escapeHtml() { return escapeHtml; },
  get formatTimeAgo() { return formatTimeAgo; },
  get formatAbsoluteTimestamp() { return formatAbsoluteTimestamp; },
  get setActiveTabButton() { return setActiveTabButton; },
  get closeModal() { return closeModal; },
  get showPage() { return showPage; },
  get getNcrById() { return window.getNcrById; }
};

//burda qalmışam

window.onpopstate = async () => {
  if (window.location.pathname === '/login') {
    showLoginView();
    return;
  }
  const ok = await ensureAuthenticated();
  if (!ok) return;
  showAppView();
  const page = routeToInitialPage();
  await showPage(page, null);
};


let currentFormType = '';
function handleNewItem(forcedId) {
  const btn = document.querySelector('#record-form button[type="submit"]'); if(btn) btn.style.display = 'inline-flex';
  const id = forcedId || document.querySelector('.page.active').id.replace('page-', ''); currentFormType = id;
  const fields = document.getElementById('form-fields'), title = document.getElementById('modal-title');
  document.getElementById('form-id').value = ''; fields.innerHTML = '';
  if(id === 'audits') {
    buildAuditForm();
  } else if(id === 'documents') {
    buildDocumentForm();
  } else if(id === 'ncr') {
    buildNcrForm();
  } else if(id === 'capa') {
    buildCapaForm();
  } else { alert('Form not implemented.'); return; }
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  setDocumentCompareModalLayout(false);
  setDocumentInfoModalLayout(false);
  const form = document.getElementById('record-form');
  if (form) form.onsubmit = submitRecord;
}

function setDocumentCompareModalLayout(enabled) {
  const modal = document.querySelector('#modal-overlay > .modal');
  if (!modal) return;
  if (enabled) modal.classList.add('document-compare-modal');
  else modal.classList.remove('document-compare-modal');
}

function setDocumentInfoModalLayout(enabled) {
  const modal = document.querySelector('#modal-overlay > .modal');
  if (!modal) return;
  if (enabled) modal.classList.add('document-info-modal');
  else modal.classList.remove('document-info-modal');
}

async function submitRecord(e) {
  e.preventDefault(); 
  const formData = new FormData(e.target); 
  const id = formData.get('id');
  
  if(!id) formData.delete('id');
  
  const endpoint = currentFormType==='ncr'?'ncr':currentFormType;
  const isDocument = currentFormType === 'documents';
  const isNcr = currentFormType === 'ncr';
  
  let bodyData;
  if (isDocument || isNcr) {
    // Ensure numeric fields are correctly set in FormData before sending
    if (isNcr) {
      normalizeNcrFormData(formData);
    }
    bodyData = formData;
  } else {
    const data = Object.fromEntries(formData.entries());
    // Convert numeric fields explicitly for safety
    if (currentFormType === 'ncr') {
      normalizeNcrFormData(data);
    }
    if (currentFormType === 'audits') {
      Object.assign(data, normalizeAuditFormData(data));
    }
    if (currentFormType === 'capa') {
      Object.assign(data, normalizeCapaFormData(data));
    }
    bodyData = JSON.stringify(data);
  }
  
  let options = {
    method: id ? 'PUT' : 'POST',
    body: bodyData,
  };

  if (!isDocument && !isNcr) {
    options.headers = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  try {
    const url = id ? `${API_BASE_URL}/${endpoint}/${id}` : `${API_BASE_URL}/${endpoint}`;
    console.log(`Submitting to ${url}`, bodyData);
    
    const res = await fetch(url, options);
    
    if(res.ok) { 
      closeModal(); 
      showPage(currentFormType); 
    } 
    else { 
      const errText = await res.text();
      console.error('Server error response:', errText);
      try {
        const errJson = JSON.parse(errText);
        alert('Validation Error: ' + JSON.stringify(errJson.errors || errJson));
      } catch(e) {
        alert('Error saving record: ' + (errText || res.statusText));
      }
    }
  } catch (err) {
    console.error('Fetch error:', err);
    alert('Critical Connection Error: ' + err.message + '\n\nPlease ensure the API server is running at ' + API_BASE_URL);
  }
}

async function viewDocument(id) {
  const d = await (await fetch(`${API_BASE_URL}/documents/${id}`)).json();
  window.currentDocumentInfo = d;
  document.getElementById('modal-title').textContent = 'Document Info';
  document.getElementById('form-fields').innerHTML = `
    <div class="tabs-nav">
      <button type="button" class="tab-btn active" onclick="switchDocumentTab(event, 'info', ${d.id})">Info</button>
      <button type="button" class="tab-btn" onclick="switchDocumentTab(event, 'history', ${d.id})">History</button>
      <button type="button" class="tab-btn" onclick="switchDocumentTab(event, 'ack', ${d.id})">Acknowledgment</button>
      <button type="button" class="tab-btn" onclick="switchDocumentTab(event, 'relationships', ${d.id})">Relationships</button>
      <button type="button" class="tab-btn" onclick="switchDocumentTab(event, 'qr', ${d.id})">QR Access</button>
      <button type="button" class="tab-btn" onclick="switchDocumentTab(event, 'approval', ${d.id})">Approval</button>
    </div>

    <div id="document-tab-info">
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Doc #</span><span class="info-value">${escapeHtml(d.documentNumber)}</span></div>
        <div class="info-item"><span class="info-label">Category</span><span class="badge badge-blue">${escapeHtml(d.category)}</span></div>
        <div class="info-item" style="grid-column:span 2;"><span class="info-label">Title</span><span class="info-value">${escapeHtml(d.title)}</span></div>
        <div class="info-item"><span class="info-label">Department</span><span class="info-value">${escapeHtml(d.department || '-')}</span></div>
        <div class="info-item"><span class="info-label">Revision</span><span class="info-value">${escapeHtml(d.revision)}</span></div>
        <div class="info-item"><span class="info-label">Effective Date</span><span class="info-value">${new Date(d.effectiveDate).toLocaleDateString()}</span></div>
        <div class="info-item"><span class="info-label">Review Date</span><span class="info-value">${new Date(d.reviewDate).toLocaleDateString()}</span></div>
        <div class="info-item"><span class="info-label">Owner</span><span class="info-value">${escapeHtml(d.owner)}</span></div>
        <div class="info-item"><span class="info-label">Status</span><span class="badge badge-${getStatusBadge(d.status)}">${escapeHtml(d.status)}</span></div>
      </div>
    </div>

    <div id="document-tab-history" style="display:none;">
      <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;">
        <div class="form-group" style="margin:0; min-width: 200px;">
          <label class="form-label">Compare</label>
          <select id="doc-compare-old" class="form-input"></select>
        </div>
        <div class="form-group" style="margin:0; min-width: 200px;">
          <label class="form-label">With</label>
          <select id="doc-compare-new" class="form-input"></select>
        </div>
        <button type="button" class="btn btn-ghost" onclick="compareSelectedDocumentVersions(${d.id})" style="height:42px;">Compare</button>
      </div>
      <div id="document-versions-list" style="margin-bottom:14px;"></div>
      <div id="document-compare-result"></div>
    </div>

    <div id="document-tab-ack" style="display:none;">
      <div id="document-ack-content"></div>
    </div>

    <div id="document-tab-relationships" style="display:none;">
      <div id="document-relationships-content"></div>
    </div>

    <div id="document-tab-qr" style="display:none;">
      <div id="document-qr-content"></div>
    </div>

    <div id="document-tab-approval" style="display:none;">
      <div id="document-approval-content"></div>
    </div>
  `;
  const btn = document.querySelector('#record-form button[type="submit"]'); if(btn) btn.style.display = 'none';
  document.getElementById('modal-overlay').classList.add('active');
  setDocumentInfoModalLayout(true);
  loadDocumentApproval(d.id);
}

function switchDocumentTab(ev, tab, documentId) {
  const clicked = ev?.currentTarget || ev?.target;
  if (clicked) setActiveTabButton(clicked);

  document.getElementById('document-tab-info').style.display = tab === 'info' ? 'block' : 'none';
  document.getElementById('document-tab-history').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('document-tab-ack').style.display = tab === 'ack' ? 'block' : 'none';
  document.getElementById('document-tab-relationships').style.display = tab === 'relationships' ? 'block' : 'none';
  document.getElementById('document-tab-qr').style.display = tab === 'qr' ? 'block' : 'none';
  document.getElementById('document-tab-approval').style.display = tab === 'approval' ? 'block' : 'none';

  if (tab !== 'history') setDocumentCompareModalLayout(false);
  if (tab === 'history') loadDocumentHistory(documentId);
  if (tab === 'ack') loadDocumentAcknowledgment(documentId);
  if (tab === 'relationships') loadDocumentRelationshipsTab(documentId);
  if (tab === 'qr') loadDocumentQrAccess(documentId);
  if (tab === 'approval') loadDocumentApproval(documentId);
}










window.onload = async () => {
  try {
    const main = document.querySelector('.main-content');
    if (main && main.textContent && /async function copyUrl\(|navigator\.clipboard\.writeText|function loadMobileDocView\(/.test(main.textContent)) {
      main.querySelectorAll('pre, code, textarea, div, span').forEach(el => {
        const t = (el.textContent || '').trim();
        if (!t) return;
        if (/async function copyUrl\(|function loadMobileDocView\(|navigator\.clipboard\.writeText|API_BASE_URL/.test(t) && t.length > 200) {
          el.textContent = '';
        }
      });
    }
  } catch {
  }
  const path = window.location.pathname || '/';
  if (path === '/login') {
    showLoginView();
    const ok = await ensureAuthenticated();
    if (ok) window.location.href = '/';
    return;
  }

  const ok = await ensureAuthenticated();
  if (!ok) {
    window.location.href = '/login';
    return;
  }

  showAppView();
  const page = routeToInitialPage();
  await showPage(page, null);
  if (page === 'users') history.replaceState({}, '', '/settings/users');
};

document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + N: New CAPA
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    console.log('Ctrl+N pressed - navigating to CAPA form');
    window.location.href = 'capa-form.html';
  }
  
  // Esc: Close modal
  if (e.key === 'Escape') {
    console.log('Esc pressed - closing modal');
    closeModal();
  }
});
