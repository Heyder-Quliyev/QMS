function nonConformanceReportsDeps() {
  return window.__nonConformanceReportsDeps || {};
}

function ncrApiBaseUrl() {
  return nonConformanceReportsDeps().API_BASE_URL || '/api';
}

function ncrGetStatusBadge(status) {
  const fn = nonConformanceReportsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function ncrGetSeverityBadge(severity) {
  const fn = nonConformanceReportsDeps().getSeverityBadge;
  return typeof fn === 'function' ? fn(severity) : 'gray';
}

function ncrFormatTimeAgo(value) {
  const fn = nonConformanceReportsDeps().formatTimeAgo;
  return typeof fn === 'function' ? fn(value) : '';
}

function ncrSetActiveTabButton(clickedButton) {
  const fn = nonConformanceReportsDeps().setActiveTabButton;
  if (typeof fn === 'function') return fn(clickedButton);
}

function ncrSetCurrentFormType(value) {
  const fn = nonConformanceReportsDeps().setCurrentFormType;
  if (typeof fn === 'function') return fn(value);
}

let allNcrs = [];
let ncrChart = null;
let currentNCRTab = 'active';

function getNcrById(id) {
  return allNcrs.find(n => n.id === id) || null;
}

async function fetchNcrs() {
  const res = await fetch(`${ncrApiBaseUrl()}/ncr`);
  allNcrs = await res.json();
  updateNCRStats();
  filterNcrs();
  updateNCRChart();
}

function updateNCRStats() {
  const s = {
    total: allNcrs.length,
    open: allNcrs.filter(n => n.status.toLowerCase() === 'open').length,
    inv: allNcrs.filter(n => n.status.toLowerCase() === 'investigation').length,
    closed: allNcrs.filter(n => n.status.toLowerCase() === 'closed').length
  };
  document.getElementById('ncr-stat-total').textContent = s.total;
  document.getElementById('ncr-stat-open').textContent = s.open;
  document.getElementById('ncr-stat-inv').textContent = s.inv;
  document.getElementById('ncr-stat-closed').textContent = s.closed;
}

function filterNcrs() {
  const term = document.getElementById('ncr-search').value.toLowerCase();
  let filtered = allNcrs.filter(n =>
    n.ncrNumber.toLowerCase().includes(term) ||
    n.title.toLowerCase().includes(term) ||
    n.description.toLowerCase().includes(term) ||
    n.area.toLowerCase().includes(term) ||
    n.category.toLowerCase().includes(term) ||
    n.raisedBy.toLowerCase().includes(term)
  );

  if (currentNCRTab === 'active') {
    filtered = filtered.filter(n => n.status.toLowerCase() !== 'closed');
  } else {
    filtered = filtered.filter(n => n.status.toLowerCase() === 'closed');
  }

  renderNCRTable(filtered);
}

function renderNCRTable(ncrs) {
  document.querySelector('#page-ncr tbody').innerHTML = ncrs.map(n => `
    <tr>
      <td style="color:var(--accent2);font-weight:500">${n.ncrNumber}</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          ${n.title}
          ${n.fileName ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" title="Has attachment"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>` : ''}
        </div>
      </td>
      <td><span class="badge badge-blue">${n.category}</span></td>
      <td>${n.area}</td>
      <td><span class="badge badge-${ncrGetSeverityBadge(n.severity)}">${n.severity}</span></td>
      <td>${n.raisedBy}</td>
      <td>${new Date(n.date).toLocaleDateString()}</td>
      <td><span class="badge badge-${ncrGetStatusBadge(n.status)}">${n.status}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" onclick="openCapaPage(${n.id})" title="Add CAPA" style="color: var(--accent2); border-color: rgba(59,139,255,0.3);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
          <button class="btn-icon" onclick="viewNCR(${n.id})" title="Info"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></button>
          <button class="btn-icon edit" onclick="editNCR(${n.id})" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon delete" onclick="deleteNCR(${n.id})" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
          ${n.fileName ? `<button class="btn-icon" onclick="downloadNCRFile(${n.id})" title="Download Attachment"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function downloadNCRFile(id) {
  window.open(`${ncrApiBaseUrl()}/ncr/download/${id}`, '_blank');
}

function setNCRTab(tab, el) {
  currentNCRTab = tab;
  document.querySelectorAll('#page-ncr .tab-item').forEach(item => item.classList.remove('active'));
  el.classList.add('active');
  filterNcrs();
}

function updateNCRChart() {
  const ctx = document.getElementById('ncrChart').getContext('2d');
  const period = document.getElementById('ncr-goal-period').value;
  const goalValue = parseInt(document.getElementById('ncr-goal-value').value, 10) || 0;
  const ChartCtor = window.Chart;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const counts = new Array(12).fill(0);
  allNcrs.forEach(n => {
    const month = new Date(n.date).getMonth();
    counts[month]++;
  });

  let labels = monthNames;
  let data = counts;

  if (period === '6months') {
    labels = monthNames.slice(0, 6);
    data = counts.slice(0, 6);
  } else if (period === 'quarterly') {
    labels = monthNames.slice(0, 3);
    data = counts.slice(0, 3);
  }

  if (ncrChart) ncrChart.destroy();

  ncrChart = new ChartCtor(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'NCR Count',
        data,
        backgroundColor: 'rgba(59, 139, 255, 0.6)',
        borderColor: 'var(--accent2)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-muted)' } },
        x: { grid: { display: false }, ticks: { color: 'var(--text-muted)' } }
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: goalValue,
              yMax: goalValue,
              borderColor: 'var(--accent3)',
              borderWidth: 2,
              borderDash: [5, 5],
              label: { content: 'Target', enabled: true, position: 'end' }
            }
          }
        }
      }
    },
    plugins: [{
      id: 'goalLine',
      afterDraw: chart => {
        const { ctx: chartCtx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
        const yPos = y.getPixelForValue(goalValue);
        if (yPos >= top && yPos <= bottom) {
          chartCtx.save();
          chartCtx.strokeStyle = '#ff6b35';
          chartCtx.lineWidth = 2;
          chartCtx.setLineDash([5, 5]);
          chartCtx.beginPath();
          chartCtx.moveTo(left, yPos);
          chartCtx.lineTo(right, yPos);
          chartCtx.stroke();
          chartCtx.fillStyle = '#ff6b35';
          chartCtx.fillText('Goal: ' + goalValue, right - 50, yPos - 5);
          chartCtx.restore();
        }
      }
    }]
  });
}

function buildNcrForm() {
  const title = document.getElementById('modal-title');
  const fields = document.getElementById('form-fields');
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (!fields) return;
  ncrSetCurrentFormType('ncr');
  if (btn) btn.style.display = 'inline-flex';
  if (title) title.textContent = 'New NCR';
  fields.innerHTML = `
      <div class="form-group"><label class="form-label">NCR #</label><input type="text" name="ncrNumber" class="form-input" required></div>
      <div class="form-group"><label class="form-label">Title</label><input type="text" name="title" class="form-input" required></div>
      <div class="form-group"><label class="form-label">Description</label><textarea name="description" class="form-input" rows="2" required></textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Area</label><input type="text" name="area" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Category</label><input type="text" name="category" class="form-input" required></div>
      </div>
      <div class="form-group">
        <label class="form-label">Risk Severity (Probability x Impact)</label>
        <input type="hidden" name="severity" id="ncr-severity-input">
        <input type="hidden" name="likelihoodScore" id="ncr-likelihood-input">
        <input type="hidden" name="consequenceScore" id="ncr-consequence-input">
        
        <div class="risk-matrix-container">
          <div class="risk-matrix">
            <div class="risk-matrix-header" style="font-size:8px;">Prob \\ Imp</div>
            <div class="risk-matrix-header">Insignif (1)</div>
            <div class="risk-matrix-header">Minor (2)</div>
            <div class="risk-matrix-header">Signif (3)</div>
            <div class="risk-matrix-header">Major (4)</div>
            <div class="risk-matrix-header">Severe (5)</div>
            
            <div class="risk-matrix-header">Certain (5)</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(5,1,'5',this)">5</div>
            <div class="risk-matrix-cell risk-4" onclick="selectRisk(5,2,'10',this)">10</div>
            <div class="risk-matrix-cell risk-5" onclick="selectRisk(5,3,'15',this)">15</div>
            <div class="risk-matrix-cell risk-6" onclick="selectRisk(5,4,'20',this)">20</div>
            <div class="risk-matrix-cell risk-6" onclick="selectRisk(5,5,'25',this)">25</div>
            
            <div class="risk-matrix-header">Likely (4)</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(4,1,'4',this)">4</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(4,2,'8',this)">8</div>
            <div class="risk-matrix-cell risk-4" onclick="selectRisk(4,3,'12',this)">12</div>
            <div class="risk-matrix-cell risk-5" onclick="selectRisk(4,4,'16',this)">16</div>
            <div class="risk-matrix-cell risk-6" onclick="selectRisk(4,5,'20',this)">20</div>
            
            <div class="risk-matrix-header">Moderate (3)</div>
            <div class="risk-matrix-cell risk-1" onclick="selectRisk(3,1,'3',this)">3</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(3,2,'6',this)">6</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(3,3,'9',this)">9</div>
            <div class="risk-matrix-cell risk-4" onclick="selectRisk(3,4,'12',this)">12</div>
            <div class="risk-matrix-cell risk-5" onclick="selectRisk(3,5,'15',this)">15</div>
            
            <div class="risk-matrix-header">Unlikely (2)</div>
            <div class="risk-matrix-cell risk-1" onclick="selectRisk(2,1,'2',this)">2</div>
            <div class="risk-matrix-cell risk-1" onclick="selectRisk(2,2,'4',this)">4</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(2,3,'6',this)">6</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(2,4,'8',this)">8</div>
            <div class="risk-matrix-cell risk-4" onclick="selectRisk(2,5,'10',this)">10</div>
            
            <div class="risk-matrix-header">Rarely (1)</div>
            <div class="risk-matrix-cell risk-1" onclick="selectRisk(1,1,'1',this)">1</div>
            <div class="risk-matrix-cell risk-1" onclick="selectRisk(1,2,'2',this)">2</div>
            <div class="risk-matrix-cell risk-1" onclick="selectRisk(1,3,'3',this)">3</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(1,4,'4',this)">4</div>
            <div class="risk-matrix-cell risk-3" onclick="selectRisk(1,5,'5',this)">5</div>
          </div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Raised By</label><input type="text" name="raisedBy" class="form-input" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input type="date" name="date" class="form-input" required></div>
        <div class="form-group"><label class="form-label">Status</label><select name="status" class="form-input"><option>Open</option><option>Investigation</option><option>Closed</option></select></div>
      </div>
      <div class="form-group"><label class="form-label">Attachment (Photo/Document)</label><input type="file" name="file" class="form-input"></div>
    `;
}

function normalizeNcrFormData(formData) {
  if (formData && typeof formData.get === 'function' && typeof formData.set === 'function') {
    const likelihood = formData.get('likelihoodScore');
    const consequence = formData.get('consequenceScore');
    if (!likelihood || likelihood === '') formData.set('likelihoodScore', '0');
    if (!consequence || consequence === '') formData.set('consequenceScore', '0');
    return formData;
  }

  if (formData && typeof formData === 'object') {
    formData.likelihoodScore = formData.likelihoodScore ? parseInt(formData.likelihoodScore, 10) : 0;
    formData.consequenceScore = formData.consequenceScore ? parseInt(formData.consequenceScore, 10) : 0;
    if (formData.id) formData.id = parseInt(formData.id, 10);
  }
  return formData;
}

function selectRisk(likelihood, consequence, label, el) {
  document.getElementById('ncr-severity-input').value = label;
  document.getElementById('ncr-likelihood-input').value = likelihood;
  document.getElementById('ncr-consequence-input').value = consequence;

  document.querySelectorAll('.risk-matrix-cell').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

async function viewNCR(id) {
  const n = await (await fetch(`${ncrApiBaseUrl()}/ncr/${id}`)).json();
  document.getElementById('modal-title').textContent = 'NCR Info';
  document.getElementById('form-fields').innerHTML = `
    <div class="tabs-nav">
      <button type="button" class="tab-btn active" onclick="switchNcrTab(event, 'info')">Info</button>
      <button type="button" class="tab-btn" onclick="switchNcrTab(event, 'history', ${n.id})">History</button>
    </div>
    
    <div id="ncr-tab-info">
      <div class="info-grid">
        <div class="info-item"><span class="info-label">NCR #</span><span class="info-value">${n.ncrNumber}</span></div>
        <div class="info-item"><span class="info-label">Category</span><span class="badge badge-blue">${n.category}</span></div>
        <div class="info-item" style="grid-column:span 2;"><span class="info-label">Title</span><span class="info-value">${n.title}</span></div>
        <div class="info-item" style="grid-column:span 2;"><span class="info-label">Description</span><span class="info-value">${n.description}</span></div>
        <div class="info-item"><span class="info-label">Area</span><span class="info-value">${n.area}</span></div>
        <div class="info-item"><span class="info-label">Severity</span><span class="badge badge-${ncrGetSeverityBadge(n.severity)}">${n.severity}</span></div>
        <div class="info-item"><span class="info-label">Raised By</span><span class="info-value">${n.raisedBy}</span></div>
        <div class="info-item"><span class="info-label">Date</span><span class="info-value">${new Date(n.date).toLocaleDateString()}</span></div>
        <div class="info-item"><span class="info-label">Status</span><span class="badge badge-${ncrGetStatusBadge(n.status)}">${n.status}</span></div>
        ${n.fileName ? `
          <div class="info-item" style="grid-column:span 2;">
            <span class="info-label">Attachment</span>
            <div style="margin-top:8px; border:1px solid var(--border); border-radius:8px; padding:12px; background:rgba(255,255,255,0.02);">
              ${(n.fileName.toLowerCase().endsWith('.jpg') || n.fileName.toLowerCase().endsWith('.jpeg') || n.fileName.toLowerCase().endsWith('.png') || n.fileName.toLowerCase().endsWith('.gif') || n.fileName.toLowerCase().endsWith('.webp'))
                ? `<img src="${ncrApiBaseUrl().replace('/api', '')}/Uploads/${n.fileName}" style="max-width:100%; border-radius:4px; margin-bottom:10px; display:block;">`
                : `<div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg> <span style="font-size:13px;">${n.fileName}</span></div>`}
              <button type="button" class="btn btn-ghost" onclick="downloadNCRFile(${n.id})" style="padding:6px 12px; font-size:12px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download
              </button>
            </div>
          </div>` : ''}
      </div>
    </div>

    <div id="ncr-tab-history" style="display:none;">
      <div id="ncr-history-feed"></div>
    </div>
  `;
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (btn) btn.style.display = 'none';
  document.getElementById('modal-overlay').classList.add('active');
}

function switchNcrTab(ev, tab, ncrId) {
  const clicked = ev?.currentTarget || ev?.target;
  if (clicked) ncrSetActiveTabButton(clicked);

  if (tab === 'info') {
    document.getElementById('ncr-tab-info').style.display = 'block';
    document.getElementById('ncr-tab-history').style.display = 'none';
  } else if (tab === 'history') {
    document.getElementById('ncr-tab-info').style.display = 'none';
    document.getElementById('ncr-tab-history').style.display = 'block';
    loadNcrHistory(ncrId);
  }
}

async function loadNcrHistory(ncrId) {
  const feed = document.getElementById('ncr-history-feed');
  feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading history...</div>';

  try {
    const res = await fetch(`${ncrApiBaseUrl()}/ncr/${ncrId}/history`);
    const data = await res.json();
    const history = data.entries || data;

    if (history.length === 0) {
      feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No history yet.</div>';
      return;
    }

    feed.innerHTML = history.map(h => `
      <div class="activity-item activity-history" style="margin-bottom:16px;">
        <div class="activity-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M9 20v-10M15 20v-2M3 20h18"/></svg>
        </div>
        <div class="activity-content" style="background:transparent; border:none; padding:0;">
          <div class="activity-text"><strong>${h.userName}</strong> ${h.action}</div>
          <span class="activity-time">${ncrFormatTimeAgo(h.timestamp)}</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    feed.innerHTML = '<div style="text-align:center; padding:20px; color:var(--accent3);">Error loading history.</div>';
  }
}

async function editNCR(id) {
  const n = await (await fetch(`${ncrApiBaseUrl()}/ncr/${id}`)).json();
  buildNcrForm();
  document.getElementById('modal-title').textContent = 'Edit NCR';
  document.getElementById('form-id').value = n.id;
  const f = document.getElementById('record-form');
  f.ncrNumber.value = n.ncrNumber;
  f.title.value = n.title;
  f.description.value = n.description;
  f.area.value = n.area;
  f.category.value = n.category;
  f.raisedBy.value = n.raisedBy;
  f.date.value = n.date.split('T')[0];
  f.status.value = n.status;

  if (n.severity) {
    document.getElementById('ncr-severity-input').value = n.severity;
    const cells = document.querySelectorAll('.risk-matrix-cell');
    cells.forEach(c => {
      if (c.textContent === n.severity) c.classList.add('selected');
    });
  }

  document.getElementById('modal-overlay').classList.add('active');
}

async function deleteNCR(id) {
  if (confirm('Delete this NCR?')) {
    const res = await fetch(`${ncrApiBaseUrl()}/ncr/${id}`, { method: 'DELETE' });
    if (res.ok) fetchNcrs();
  }
}

