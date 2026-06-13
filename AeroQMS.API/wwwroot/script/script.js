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

let capaStatusChart = null;

// Dashboard
async function loadCapaDashboard() {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard/capa-stats`);
    const data = await res.json();
    
    // Update summary cards
    document.getElementById('capa-total-active').textContent = data.total_active;
    document.getElementById('capa-overdue').textContent = data.overdue_count;
    document.getElementById('capa-due-week').textContent = data.due_this_week;
    document.getElementById('capa-pending-verify').textContent = data.pending_verification;
    
    // Update metrics
    document.getElementById('capa-rate-30d').textContent = data.metrics.completion_rate + '%';
    document.getElementById('capa-avg-time').textContent = data.metrics.avg_days_to_complete + 'd';
    
    // Render Chart
    renderCapaStatusChart(data.status_distribution);
    
    // Render Priority Actions
    const priorityList = document.getElementById('capa-top-priority');
    if (data.top_priority.length === 0) {
      priorityList.innerHTML = '<div style="font-size:11px; color:var(--text-muted); text-align:center;">No active actions.</div>';
    } else {
      const safePriorityClass = (p) => {
        const s = (p || '').toString().toLowerCase();
        return /^[a-z0-9_-]+$/.test(s) ? s : 'medium';
      };
      priorityList.innerHTML = data.top_priority.map(a => `
        <div class="action-mini">
          <span class="priority-dot priority-${safePriorityClass(a.priority)}"></span>
          <div class="action-info">
            <strong>${escapeHtml(String(a.title || ''))}</strong>
            <small>Due ${escapeHtml(String(a.dueDateRelative || ''))}</small>
          </div>
          <button class="btn-sm" onclick="viewCapa('${escapeHtml(String(a.id || ''))}')" style="padding:2px 8px; font-size:10px;">View</button>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load CAPA dashboard:', error);
  }
}

function renderCapaStatusChart(statusData) {
  const ctx = document.getElementById('capa-status-chart').getContext('2d');
  
  if (capaStatusChart) {
    capaStatusChart.destroy();
  }
  
  capaStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Not Started', 'In Progress', 'Pending Verification', 'Verified'],
      datasets: [{
        data: [
          statusData.not_started,
          statusData.in_progress,
          statusData.pending_verification,
          statusData.verified
        ],
        backgroundColor: ['#6b7280', '#facc15', '#3b82f6', '#10b981'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#fff', font: { size: 10 }, padding: 15 }
        }
      }
    }
  });
}

// Auto-refresh every 5 minutes when on dashboard
setInterval(() => {
  const dashboardPage = document.getElementById('page-dashboard');
  if (dashboardPage && dashboardPage.classList.contains('active')) {
    loadCapaDashboard();
  }
}, 5 * 60 * 1000);

function showToast(message, type = 'info') {
  console.log(`[Toast] ${type}: ${message}`);
  alert(message);
}

function escapeHtml(value) {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchSuppliers() { const res = await fetch(`${API_BASE_URL}/suppliers`); const data = await res.json(); document.querySelector('#page-suppliers tbody').innerHTML = data.map(s => `<tr><td>${s.name}</td><td>${s.category}</td><td>${s.country}</td><td>${s.rating}</td><td>${s.lastAudit}</td><td><span class="badge badge-${getStatusBadge(s.status)}">${s.status}</span></td></tr>`).join(''); }
function getStatusBadge(s) { const l = s.toLowerCase(); if(['approved','valid','complete','closed','completed','verified'].includes(l)) return 'green'; if(['in progress','due for review','expiring','under review','investigation','open','pending_verification'].includes(l)) return 'yellow'; if(['overdue','expired','suspended'].includes(l)) return 'red'; if(l==='scheduled') return 'blue'; return 'gray'; }
function getSeverityBadge(s) { 
  if(!s) return 'gray';
  const val = parseInt(s);
  if (!isNaN(val)) {
    if (val >= 20) return 'risk-extreme';
    if (val >= 15) return 'risk-crit';
    if (val >= 10) return 'risk-high';
    if (val >= 5) return 'risk-med';
    return 'risk-low';
  }
  const l = s.toString().toLowerCase(); 
  if (l.includes('e') || l.includes('d') || l === 'critical') return 'risk-crit';
  if (l.includes('c') || l === 'major') return 'risk-med';
  if (l.includes('b') || l === 'minor') return 'risk-low';
  return 'gray'; 
}
function getRiskBadge(s) { const l = s.toLowerCase(); return l==='high'?'red':(l==='medium'?'yellow':'gray'); }
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

function getPriorityBadge(p) {
  const l = p?.toLowerCase();
  return l === 'critical' ? 'red' : (l === 'high' ? 'orange' : (l === 'medium' ? 'yellow' : 'gray'));
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
    await trackDocumentAccess(documentId, 'qr');
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}?_=${Date.now()}`, { cache: 'no-store' });
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
    badge.className = `badge badge-${getStatusBadge(status)}`;
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
    iframe.src = `${API_BASE_URL}/documents/view/${documentId}`;
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
  await showPage('ncr', null);
  showToast(`Create an NCR for DOC ID ${documentId}`, 'success');
}

function downloadDoc(documentId) {
  window.open(`${API_BASE_URL}/documents/download/${documentId}`, '_blank');
}

async function shareDoc(documentId) {
  const url = buildDocumentShortUrl(documentId);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Document', url });
      return;
    }
  } catch {
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Copied', 'success');
  } catch {
    showToast('Copy failed', 'error');
  }
}

function formatDocumentVersionLabel(v) {
  const rev = v?.revision ? `Rev. ${v.revision}` : 'Revision';
  const suffix = v?.is_current ? ' (Current)' : (v?.snapshot_at ? ` (${new Date(v.snapshot_at).toLocaleDateString()})` : '');
  return `${rev}${suffix}`;
}

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

function formatAckDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function initialsFromName(name) {
  const n = (name || '').trim();
  if (!n) return 'U';
  return n.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'U';
}

async function refreshAckNavBadge() {
  const badge = document.getElementById('ack-nav-badge');
  if (!badge) return;
  try {
    const res = await fetch(`${API_BASE_URL}/documents/my-documents?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      badge.style.display = 'none';
      return;
    }
    const data = await res.json().catch(() => null);
    const count = data?.count ?? 0;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? '' : 'none';
  } catch {
    badge.style.display = 'none';
  }
}

async function loadMyReviewTasks() {
  const tbody = document.getElementById('my-review-tasks-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE_URL}/reviews/my-tasks?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed');
    const tasks = data?.tasks || [];
    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">No review tasks.</td></tr>';
      return;
    }
    tbody.innerHTML = tasks.map(t => {
      const due = parseInt(t.due_in_days, 10);
      const badge = due < 0 ? 'red' : (due <= 7 ? 'orange' : 'yellow');
      const dueLabel = isNaN(due) ? '-' : (due < 0 ? `${Math.abs(due)} overdue` : `${due} days`);
      return `
        <tr>
          <td>
            <div style="font-weight:800;">${escapeHtml(t.document_number || '')}</div>
            <div style="color:var(--text-muted); font-size:12px;">${escapeHtml(t.title || '')}</div>
          </td>
          <td>${escapeHtml(t.category || '')}</td>
          <td>${escapeHtml(t.owner || '')}</td>
          <td>${t.review_date ? new Date(t.review_date).toLocaleDateString() : '-'}</td>
          <td>${escapeHtml(dueLabel)}</td>
          <td><span class="badge badge-${badge}">${escapeHtml(t.urgency || '')}</span></td>
          <td><button type="button" class="btn btn-primary" style="padding:6px 10px; font-size:12px;" onclick="startReview(${t.id})">Start Review</button></td>
        </tr>
      `;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--accent3);">Error loading review tasks.</td></tr>';
  }
}

async function startReview(documentId) {
  if (!documentId) return;
  await showPage('documents', null);
  await viewDocument(documentId);
}

async function loadDocumentAcknowledgment(documentId) {
  const el = document.getElementById('document-ack-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading acknowledgment...</div>';
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/summary?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || 'Failed');

    const stats = data.stats || {};
    const groups = data.groups || [];
    const perms = data.permissions || {};
    const pct = Math.max(0, Math.min(100, parseInt(stats.pct || 0, 10) || 0));
    const dash = `${pct}, 100`;
    const docTitle = data?.document?.title || '';
    const docRev = data?.document?.revision || '';
    const dueDate = stats.due_date ? new Date(stats.due_date).toLocaleDateString() : '-';
    const canManage = !!perms.can_manage;

    let isCurrentUserPending = false;
    const currentUserId = window.CURRENT_USER?.Id;
    if (currentUserId != null) {
      for (const g of (groups || [])) {
        for (const p of (g.personnel || [])) {
          if (p.user_id === currentUserId) {
            isCurrentUserPending = !p.acknowledged;
            break;
          }
        }
      }
    }

    el.innerHTML = `
      <div class="acknowledgment-tab">
        <div class="ack-stats">
          <div class="ack-stat">
            <div class="ack-progress-circle">
              <svg viewBox="0 0 36 36">
                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
                <path class="circle" stroke-dasharray="${dash}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"></path>
              </svg>
              <span class="progress-value">${pct}%</span>
            </div>
            <div class="ack-stat-info">
              <strong>${escapeHtml(String(stats.acknowledged ?? 0))}/${escapeHtml(String(stats.total ?? 0))} Personnel</strong>
              <p>Have acknowledged this document • Due: ${escapeHtml(dueDate)}</p>
            </div>
          </div>
          <div class="ack-actions">
            ${isCurrentUserPending ? `<button type="button" class="btn btn-primary" onclick='openAckConfirmModal(${documentId}, ${JSON.stringify(docTitle)}, ${JSON.stringify(docRev)})'>I Have Read &amp; Understood</button>` : ''}
            ${canManage ? `<button type="button" class="btn btn-primary" onclick="sendAckReminders(${documentId})">Send Reminders</button>` : ''}
            ${canManage ? `<button type="button" class="btn btn-ghost" onclick="exportAckReport(${documentId})">Export Report</button>` : ''}
          </div>
        </div>

        <div class="ack-groups">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <h3>Required Acknowledgment Groups</h3>
            ${canManage ? `<button type="button" class="btn btn-ghost" onclick="openAckRequirementModal(${documentId})">+ Add Required Group</button>` : ''}
          </div>

          ${(!groups || groups.length === 0) ? `<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">No acknowledgment requirements configured.</div>` : `
            ${groups.map(g => `
              <div class="ack-group-item">
                <div class="ack-group-header">
                  <div class="ack-group-info">
                    <strong>${escapeHtml(g.group || '')}</strong>
                    <span>${escapeHtml(String(g.acknowledged || 0))}/${escapeHtml(String(g.total || 0))} acknowledged</span>
                  </div>
                  <div class="ack-group-progress">
                    <div class="ack-progress-bar">
                      <div class="ack-progress-fill" style="width:${escapeHtml(String(g.pct || 0))}%"></div>
                    </div>
                    <span style="font-size:12px; font-weight:900;">${escapeHtml(String(g.pct || 0))}%</span>
                  </div>
                </div>
                <div class="ack-personnel">
                  ${(g.personnel || []).map(p => `
                    <div class="ack-person-item">
                      <div class="ack-person-left">
                        <div class="avatar-xs">${escapeHtml(initialsFromName(p.name))}</div>
                        <div class="ack-person-name" title="${escapeHtml(p.name || '')}">${escapeHtml(p.name || '')}</div>
                      </div>
                      <div class="ack-person-meta">
                        ${p.acknowledged ? `<span class="ack-date">${escapeHtml(formatAckDate(p.acknowledged_at))}</span>` : `<span class="pending-pill">Pending</span>`}
                        ${(!p.acknowledged && canManage) ? `<button type="button" class="btn btn-ghost" style="padding:6px 10px; font-size:12px;" onclick="sendAckReminder(${documentId}, ${p.user_id})">Send Reminder</button>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          `}
        </div>
      </div>
    `;
  } catch {
    el.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading acknowledgment.</div>';
  }
}

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

window.ackConfirmContext = { documentId: null, title: '', revision: '' };
function openAckConfirmModal(documentId, title, revision) {
  window.ackConfirmContext = { documentId, title: title || '', revision: revision || '' };
  const titleEl = document.getElementById('ack-confirm-doc-title');
  const revEl = document.getElementById('ack-confirm-doc-rev');
  const checkbox = document.getElementById('ack-confirm-checkbox');
  if (titleEl) titleEl.textContent = title || '';
  if (revEl) revEl.textContent = revision || '';
  if (checkbox) checkbox.checked = false;
  const overlay = document.getElementById('ack-confirm-modal');
  if (overlay) overlay.classList.add('active');
}

function closeAckConfirmModal() {
  const overlay = document.getElementById('ack-confirm-modal');
  if (overlay) overlay.classList.remove('active');
}

async function submitAcknowledgment() {
  const checkbox = document.getElementById('ack-confirm-checkbox');
  if (!checkbox || !checkbox.checked) return;
  const documentId = window.ackConfirmContext?.documentId;
  if (!documentId) return;
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ confirm: true })
    });
    if (!res.ok) throw new Error(await res.text());
    closeAckConfirmModal();
    await refreshAckNavBadge();
    await loadMyDocuments();
    const ackTab = document.getElementById('document-tab-ack');
    if (ackTab && ackTab.style.display !== 'none') await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

window.ackRequirementContext = { documentId: null };
window.ackReqMentionState = {
  initialized: false,
  users: null,
  selected: [],
  mentionActive: false,
  query: '',
  results: [],
  activeIndex: 0
};

function ackReqGetMentionBox() {
  return document.getElementById('ack-req-custom-role');
}

function ackReqGetSuggestBox() {
  return document.getElementById('ack-req-custom-role-suggest');
}

function ackReqEnsureUsersLoaded() {
  if (Array.isArray(window.ackReqMentionState.users)) return Promise.resolve(window.ackReqMentionState.users);
  return fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' })
    .then(async res => {
      if (!res.ok) return [];
      const users = await res.json().catch(() => []);
      window.ackReqMentionState.users = Array.isArray(users) ? users : [];
      return window.ackReqMentionState.users;
    })
    .catch(() => []);
}

function ackReqRenderMentionBox() {
  const box = ackReqGetMentionBox();
  if (!box) return;
  box.innerHTML = '';
  (window.ackReqMentionState.selected || []).forEach(u => {
    const chip = document.createElement('span');
    chip.className = 'badge badge-blue';
    chip.setAttribute('data-user-id', String(u.id));
    chip.setAttribute('contenteditable', 'false');
    chip.textContent = u.name || u.email || `User ${u.id}`;
    chip.onclick = () => {
      window.ackReqMentionState.selected = (window.ackReqMentionState.selected || []).filter(x => x.id !== u.id);
      ackReqRenderMentionBox();
    };
    box.appendChild(chip);
    box.appendChild(document.createTextNode(' '));
  });
  if (window.ackReqMentionState.mentionActive) {
    box.appendChild(document.createTextNode(`@${window.ackReqMentionState.query || ''}`));
  } else {
    box.appendChild(document.createTextNode(''));
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
  }
}

function ackReqCloseSuggestions() {
  const suggest = ackReqGetSuggestBox();
  if (suggest) {
    suggest.hidden = true;
    suggest.innerHTML = '';
  }
  window.ackReqMentionState.results = [];
  window.ackReqMentionState.activeIndex = 0;
}

function ackReqUpdateSuggestions() {
  const suggest = ackReqGetSuggestBox();
  if (!suggest) return;
  if (!window.ackReqMentionState.mentionActive) {
    ackReqCloseSuggestions();
    return;
  }
  const q = (window.ackReqMentionState.query || '').trim().toLowerCase();
  const users = Array.isArray(window.ackReqMentionState.users) ? window.ackReqMentionState.users : [];
  const selectedIds = new Set((window.ackReqMentionState.selected || []).map(u => u.id));
  const matches = users
    .filter(u => !selectedIds.has(u.id))
    .filter(u => {
      if (!q) return true;
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    })
    .slice(0, 8);

  window.ackReqMentionState.results = matches;
  window.ackReqMentionState.activeIndex = 0;

  if (matches.length === 0) {
    suggest.hidden = true;
    suggest.innerHTML = '';
    return;
  }

  suggest.hidden = false;
  suggest.innerHTML = matches.map((u, idx) => {
    const label = `${escapeHtml(u.name || '')}${u.email ? ` (${escapeHtml(u.email)})` : ''}`;
    const active = idx === (window.ackReqMentionState.activeIndex || 0);
    return `<button type="button" class="btn btn-ghost" data-idx="${idx}" data-user-id="${u.id}" aria-selected="${active ? 'true' : 'false'}">${label}</button>`;
  }).join('');

  Array.from(suggest.querySelectorAll('button[data-user-id]')).forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-user-id') || '', 10);
      if (!isNaN(id)) ackReqSelectUserById(id);
    };
  });
}

function ackReqSelectUserById(userId) {
  const users = Array.isArray(window.ackReqMentionState.users) ? window.ackReqMentionState.users : [];
  const user = users.find(u => u.id === userId);
  if (!user) {
    showToast('User not found', 'error');
    return;
  }
  const exists = (window.ackReqMentionState.selected || []).some(u => u.id === userId);
  if (!exists) window.ackReqMentionState.selected = [...(window.ackReqMentionState.selected || []), user];
  window.ackReqMentionState.mentionActive = false;
  window.ackReqMentionState.query = '';
  ackReqCloseSuggestions();
  ackReqRenderMentionBox();
}

function ackReqTrySelectActiveResult() {
  const results = window.ackReqMentionState.results || [];
  const idx = window.ackReqMentionState.activeIndex || 0;
  const pick = results[idx] || results[0];
  if (!pick) {
    showToast('No matching user found', 'error');
    return false;
  }
  ackReqSelectUserById(pick.id);
  return true;
}

function ackReqInitMentionInputOnce() {
  if (window.ackReqMentionState.initialized) return;
  window.ackReqMentionState.initialized = true;
  const box = ackReqGetMentionBox();
  if (!box) return;

  box.addEventListener('keydown', async (e) => {
    const roleSel = document.getElementById('ack-req-role');
    const isActive = roleSel && roleSel.value === 'custom';
    if (!isActive) return;

    const key = e.key;
    const isMention = window.ackReqMentionState.mentionActive;

    if (!isMention) {
      if (key === '@') {
        e.preventDefault();
        window.ackReqMentionState.mentionActive = true;
        window.ackReqMentionState.query = '';
        await ackReqEnsureUsersLoaded();
        ackReqRenderMentionBox();
        ackReqUpdateSuggestions();
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        const selected = window.ackReqMentionState.selected || [];
        if (selected.length > 0) {
          window.ackReqMentionState.selected = selected.slice(0, -1);
          ackReqRenderMentionBox();
        }
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        return;
      }
      if (key.length === 1) {
        e.preventDefault();
        showToast('Type "@" to search and select users', 'error');
      }
      return;
    }

    if (key === 'Escape') {
      e.preventDefault();
      window.ackReqMentionState.mentionActive = false;
      window.ackReqMentionState.query = '';
      ackReqCloseSuggestions();
      ackReqRenderMentionBox();
      return;
    }

    if (key === 'Enter' || key === 'Tab') {
      e.preventDefault();
      ackReqTrySelectActiveResult();
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      const max = (window.ackReqMentionState.results || []).length;
      if (max > 0) {
        window.ackReqMentionState.activeIndex = (window.ackReqMentionState.activeIndex + 1) % max;
        ackReqUpdateSuggestions();
      }
      return;
    }

    if (key === 'ArrowUp') {
      e.preventDefault();
      const max = (window.ackReqMentionState.results || []).length;
      if (max > 0) {
        window.ackReqMentionState.activeIndex = (window.ackReqMentionState.activeIndex - 1 + max) % max;
        ackReqUpdateSuggestions();
      }
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      const q = window.ackReqMentionState.query || '';
      if (q.length === 0) {
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
      } else {
        window.ackReqMentionState.query = q.slice(0, -1);
      }
      ackReqRenderMentionBox();
      ackReqUpdateSuggestions();
      return;
    }

    if (key === ' ') {
      e.preventDefault();
      if (!ackReqTrySelectActiveResult()) {
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
        ackReqRenderMentionBox();
      }
      return;
    }

    if (key.length === 1) {
      const ch = key;
      if (!/^[a-zA-Z0-9._-]$/.test(ch)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      window.ackReqMentionState.query = `${window.ackReqMentionState.query || ''}${ch}`;
      await ackReqEnsureUsersLoaded();
      ackReqRenderMentionBox();
      ackReqUpdateSuggestions();
      return;
    }
  });

  box.addEventListener('paste', (e) => {
    const roleSel = document.getElementById('ack-req-role');
    const isActive = roleSel && roleSel.value === 'custom';
    if (!isActive) return;
    e.preventDefault();
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('ack-req-custom-role-wrap');
    const suggest = ackReqGetSuggestBox();
    if (!wrap || !suggest || suggest.hidden) return;
    if (wrap.contains(e.target)) return;
    window.ackReqMentionState.mentionActive = false;
    window.ackReqMentionState.query = '';
    ackReqCloseSuggestions();
    ackReqRenderMentionBox();
  });
}

async function openAckRequirementModal(documentId) {
  window.ackRequirementContext = { documentId };
  const overlay = document.getElementById('ack-requirement-modal');
  if (!overlay) return;

  const roleSel = document.getElementById('ack-req-role');
  const customWrap = document.getElementById('ack-req-custom-role-wrap');
  const customInput = document.getElementById('ack-req-custom-role');
  const userSel = document.getElementById('ack-req-user');
  const dueInput = document.getElementById('ack-req-due-days');

  if (roleSel) roleSel.value = '';
  if (customInput) customInput.innerHTML = '';
  if (customWrap) customWrap.style.display = 'none';
  if (dueInput) dueInput.value = '7';
  if (userSel) userSel.innerHTML = '<option value="">Select a user</option>';
  window.ackReqMentionState.selected = [];
  window.ackReqMentionState.mentionActive = false;
  window.ackReqMentionState.query = '';
  ackReqCloseSuggestions();
  ackReqInitMentionInputOnce();
  ackReqRenderMentionBox();

  if (roleSel) {
    roleSel.onchange = () => {
      const v = roleSel.value;
      if (customWrap) customWrap.style.display = v === 'custom' ? 'block' : 'none';
      if (v !== 'custom') {
        window.ackReqMentionState.selected = [];
        window.ackReqMentionState.mentionActive = false;
        window.ackReqMentionState.query = '';
        ackReqCloseSuggestions();
        if (customInput) customInput.innerHTML = '';
      }
      ackReqRenderMentionBox();
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const users = await res.json().catch(() => []);
      window.ackReqMentionState.users = Array.isArray(users) ? users : [];
      (users || []).forEach(u => {
        const opt = document.createElement('option');
        opt.value = String(u.id);
        opt.textContent = `${u.name}`;
        if (userSel) userSel.appendChild(opt);
      });
    }
  } catch {
  }

  overlay.classList.add('active');
}

function closeAckRequirementModal() {
  const overlay = document.getElementById('ack-requirement-modal');
  if (overlay) overlay.classList.remove('active');
}

async function submitAckRequirement() {
  const documentId = window.ackRequirementContext?.documentId;
  if (!documentId) return;
  const roleSel = document.getElementById('ack-req-role');
  const customInput = document.getElementById('ack-req-custom-role');
  const userSel = document.getElementById('ack-req-user');
  const dueInput = document.getElementById('ack-req-due-days');

  let role = (roleSel?.value || '').trim();
  const isCustom = role === 'custom';
  if (isCustom) role = '';
  const userIdRaw = (userSel?.value || '').trim();
  const individualUserId = userIdRaw ? parseInt(userIdRaw, 10) : null;
  const dueDays = dueInput?.value ? parseInt(dueInput.value, 10) : 7;

  try {
    const safeDue = isNaN(dueDays) ? 7 : dueDays;

    if (isCustom) {
      if (window.ackReqMentionState.mentionActive) {
        showToast('Please select a user from the list (press Enter) or clear the @search', 'error');
        return;
      }

      const selectedIds = new Set((window.ackReqMentionState.selected || []).map(u => u.id));
      if (individualUserId) selectedIds.add(individualUserId);
      const ids = Array.from(selectedIds).filter(n => typeof n === 'number' && !isNaN(n));
      if (ids.length === 0) {
        showToast('Please @mention at least one existing user', 'error');
        return;
      }

      for (const uid of ids) {
        const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/requirements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            required_role: null,
            individual_user_id: uid,
            due_days: safeDue
          })
        });
        if (!res.ok) throw new Error(await res.text());

        await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders?user_id=${encodeURIComponent(uid)}`, { method: 'POST' }).catch(() => null);
      }
    } else {
      const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          required_role: role || null,
          individual_user_id: individualUserId,
          due_days: safeDue
        })
      });
      if (!res.ok) throw new Error(await res.text());
    }

    closeAckRequirementModal();
    await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

async function sendAckReminders(documentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    await loadDocumentAcknowledgment(documentId);
  } catch {
  }
}

async function sendAckReminder(documentId, userId) {
  try {
    const res = await fetch(`${API_BASE_URL}/documents/${documentId}/acknowledgment/reminders?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
  } catch {
  }
}

function exportAckReport(documentId) {
  window.open(`${API_BASE_URL}/documents/${documentId}/acknowledgment/report`, '_blank');
}

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

async function populateWorkflowUsers(selectId, selectedUserId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Anyone with the role above</option>';
  try {
    const res = await fetch(`${API_BASE_URL}/users/lookup?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const users = await res.json();
    (users || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.name}`;
      sel.appendChild(opt);
    });
    if (selectedUserId != null && selectedUserId !== '') sel.value = String(selectedUserId);
  } catch {}
}

async function fetchUsersAdmin() {
  if (!isAdminUser()) {
    const tbody = document.getElementById('users-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--text-muted); text-align:center;">403 — Admin only</td></tr>';
    return;
  }

  const tbody = document.getElementById('users-table-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--text-muted); text-align:center;">Loading users...</td></tr>';

  try {
    const res = await fetch(`${API_BASE_URL}/users?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--accent3); text-align:center;">Error loading users</td></tr>';
      return;
    }
    const users = await res.json();
    usersAdminCache = users || [];
    renderUsersTable(usersAdminCache);
  } catch {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--accent3); text-align:center;">Error loading users</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:16px; color:var(--text-muted); text-align:center;">No users found</td></tr>';
    return;
  }

  const formatDt = (v) => {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString();
  };

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${escapeHtml(u.name || '')}</td>
      <td>${escapeHtml(u.email || '')}</td>
      <td><span class="badge badge-blue">${escapeHtml(u.role || '')}</span></td>
      <td>${u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td>${escapeHtml(formatDt(u.last_login))}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" title="Edit" onclick="openEditUserModal(${u.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          ${u.is_active ? `<button class="btn-icon" title="Deactivate" onclick="deactivateUser(${u.id})" style="border-color: rgba(255,107,53,0.25); color: var(--accent3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>` : ''}
          <button class="btn-icon" title="Reset Password" onclick="openResetPasswordModal(${u.id})" style="border-color: rgba(59,139,255,0.25); color: var(--accent2);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M20 9A8 8 0 0 0 6.34 6.34L4 10"/><path d="M4 14a8 8 0 0 0 13.66 3.66L20 14"/></svg></button>
        </div>
      </td>
    </tr>
  `).join('');
}

let usersAdminCache = [];
async function refreshUsersAdminCache() {
  const res = await fetch(`${API_BASE_URL}/users?_=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const users = await res.json();
  usersAdminCache = users || [];
  return usersAdminCache;
}

function resetRecordModalForCustomForm() {
  const fields = document.getElementById('form-fields');
  const id = document.getElementById('form-id');
  const form = document.getElementById('record-form');
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (id) id.value = '';
  if (fields) fields.innerHTML = '';
  if (btn) btn.style.display = 'inline-flex';
  if (form) form.onsubmit = submitRecord;
}

function openAddUserModal() {
  if (!isAdminUser()) return;
  resetRecordModalForCustomForm();
  document.getElementById('modal-title').textContent = 'Add User';
  document.getElementById('form-fields').innerHTML = `
    <div class="form-group"><label class="form-label required">Full Name</label><input class="form-input" id="user-name" type="text"></div>
    <div class="form-group"><label class="form-label required">Email</label><input class="form-input" id="user-email" type="email"></div>
    <div class="form-group"><label class="form-label required">Role</label>
      <select class="form-input" id="user-role">
        <option value="Admin">Admin</option>
        <option value="Quality Manager">Quality Manager</option>
        <option value="Document Owner">Document Owner</option>
        <option value="Department Head">Department Head</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label required">Temporary Password</label><input class="form-input" id="user-password" type="password"></div>
    <label class="checkbox-label" style="margin-top:6px;"><input type="checkbox" id="user-force-change" checked><span>Force password change on first login</span></label>
  `;
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (saveBtn) saveBtn.textContent = 'Create User';
  const form = document.getElementById('record-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    await submitCreateUser();
  };
  document.getElementById('modal-overlay').classList.add('active');
}

async function submitCreateUser() {
  const name = (document.getElementById('user-name')?.value || '').trim();
  const email = (document.getElementById('user-email')?.value || '').trim();
  const role = document.getElementById('user-role')?.value || '';
  const password = document.getElementById('user-password')?.value || '';
  const forcePasswordChange = !!document.getElementById('user-force-change')?.checked;

  if (!name || !email || !role || !password) {
    showToast('All fields are required', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, password, role, forcePasswordChange })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(data?.error || 'Failed to create user', 'error');
      return;
    }
    showToast('User created', 'success');
    closeModal();
    await fetchUsersAdmin();
  } catch {
    showToast('Failed to create user', 'error');
  }
}

async function openEditUserModal(id) {
  if (!isAdminUser()) return;
  if (usersAdminCache.length === 0) await refreshUsersAdminCache();
  const u = usersAdminCache.find(x => x.id === id);
  if (!u) { showToast('User not found', 'error'); return; }

  resetRecordModalForCustomForm();
  document.getElementById('modal-title').textContent = 'Edit User';
  document.getElementById('form-fields').innerHTML = `
    <div class="form-group"><label class="form-label required">Full Name</label><input class="form-input" id="edit-user-name" type="text" value="${escapeHtml(u.name || '')}"></div>
    <div class="form-group"><label class="form-label required">Email</label><input class="form-input" id="edit-user-email" type="email" value="${escapeHtml(u.email || '')}"></div>
    <div class="form-group"><label class="form-label required">Role</label>
      <select class="form-input" id="edit-user-role">
        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
        <option value="Quality Manager" ${u.role === 'Quality Manager' ? 'selected' : ''}>Quality Manager</option>
        <option value="Document Owner" ${u.role === 'Document Owner' ? 'selected' : ''}>Document Owner</option>
        <option value="Department Head" ${u.role === 'Department Head' ? 'selected' : ''}>Department Head</option>
      </select>
    </div>
  `;
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (saveBtn) saveBtn.textContent = 'Save';
  const form = document.getElementById('record-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    await submitUpdateUser(id);
  };
  document.getElementById('modal-overlay').classList.add('active');
}

async function submitUpdateUser(id) {
  const name = (document.getElementById('edit-user-name')?.value || '').trim();
  const email = (document.getElementById('edit-user-email')?.value || '').trim();
  const role = document.getElementById('edit-user-role')?.value || '';
  if (!name || !email || !role) {
    showToast('All fields are required', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(data?.error || 'Failed to update user', 'error');
      return;
    }
    showToast('User updated', 'success');
    closeModal();
    await fetchUsersAdmin();
  } catch {
    showToast('Failed to update user', 'error');
  }
}

async function deactivateUser(id) {
  if (!isAdminUser()) return;
  if (!confirm('Deactivate this user?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/users/${id}/deactivate`, { method: 'POST', headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(data?.error || 'Failed to deactivate user', 'error');
      return;
    }
    showToast('User deactivated', 'success');
    await fetchUsersAdmin();
  } catch {
    showToast('Failed to deactivate user', 'error');
  }
}

function openResetPasswordModal(id) {
  if (!isAdminUser()) return;
  resetRecordModalForCustomForm();
  document.getElementById('modal-title').textContent = 'Reset Password';
  document.getElementById('form-fields').innerHTML = `
    <div class="form-group"><label class="form-label required">New Temporary Password</label><input class="form-input" id="reset-pass" type="password"></div>
    <label class="checkbox-label" style="margin-top:6px;"><input type="checkbox" id="reset-force-change" checked><span>Force password change on next login</span></label>
  `;
  const saveBtn = document.querySelector('#record-form button[type="submit"]');
  if (saveBtn) saveBtn.textContent = 'Reset';
  const form = document.getElementById('record-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    await submitResetPassword(id);
  };
  document.getElementById('modal-overlay').classList.add('active');
}

async function submitResetPassword(id) {
  const password = document.getElementById('reset-pass')?.value || '';
  const forcePasswordChange = !!document.getElementById('reset-force-change')?.checked;
  if (!password) { showToast('Password is required', 'error'); return; }
  try {
    const res = await fetch(`${API_BASE_URL}/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ password, forcePasswordChange })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showToast(data?.error || 'Failed to reset password', 'error');
      return;
    }
    showToast('Password reset', 'success');
    closeModal();
    await fetchUsersAdmin();
  } catch {
    showToast('Failed to reset password', 'error');
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
