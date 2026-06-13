function capaAnalyticsDeps() {
  return window.__capaAnalyticsDeps || {};
}

function capaAnalyticsApiBaseUrl() {
  return capaAnalyticsDeps().API_BASE_URL || '/api';
}

function capaAnalyticsGetStatusBadge(status) {
  const fn = capaAnalyticsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

let trendChart = null;
let categoryChart = null;
let priorityChart = null;
let timeDistChart = null;
let currentRecurringGroups = [];

async function loadCapaAnalytics() {
  try {
    const res = await fetch(`${capaAnalyticsApiBaseUrl()}/dashboard/capa-analytics?range=30`);
    const data = await res.json();

    document.getElementById('ana-completed-count').textContent = data.summary.completed_count;
    document.getElementById('ana-avg-time').textContent = data.summary.avg_completion_time + ' days';
    document.getElementById('ana-effect-rate').textContent = data.summary.effectiveness_rate + '%';
    document.getElementById('ana-recurring-count').textContent = data.recurring_ncrs.length;

    renderTrendChart(data.trend);
    renderCategoryChart(data.by_category);
    renderPriorityChart(data.by_priority);
    renderPerformersList(data.top_performers);
    renderTimeDistChart(data.time_distribution);
    renderRecurringTable(data.recurring_ncrs);
  } catch (error) {
    console.error('Failed to load CAPA analytics:', error);
  }
}

function renderTrendChart(data) {
  const ctx = document.getElementById('trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.dates.map(d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })),
      datasets: [
        { label: 'Created', data: data.created, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4, fill: true },
        { label: 'Completed', data: data.completed, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { labels: { color: '#fff' } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: { color: '#888', maxRotation: 45, minRotation: 45 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#888', stepSize: 1 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('category-chart').getContext('2d');
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.categories,
      datasets: [{ label: 'CAPAs', data: data.counts, backgroundColor: '#3b82f6' }]
    },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888' } }, y: { ticks: { color: '#fff' } } } }
  });
}

function renderPriorityChart(data) {
  const ctx = document.getElementById('priority-chart').getContext('2d');
  if (priorityChart) priorityChart.destroy();
  priorityChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{ data: [data.critical, data.high, data.medium, data.low], backgroundColor: ['#ef4444', '#f97316', '#fbbf24', '#6b7280'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
  });
}

function renderTimeDistChart(dist) {
  const ctx = document.getElementById('time-dist-chart').getContext('2d');
  if (timeDistChart) timeDistChart.destroy();
  timeDistChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0-7d', '8-14d', '15-30d', '31-60d', '60d+'],
      datasets: [{ label: 'Actions', data: dist, backgroundColor: '#10b981' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888' } }, y: { beginAtZero: true, ticks: { color: '#888' } } } }
  });
}

function renderPerformersList(performers) {
  const list = document.getElementById('ana-performers');
  list.innerHTML = performers.map(p => `
    <div class="performer-item">
      <div class="avatar-sm">${p.name.charAt(0)}</div>
      <div class="performer-info">
        <strong>${p.name}</strong>
        <div class="progress-bar-mini">
          <div class="progress-fill" style="width: ${p.rate}%"></div>
        </div>
      </div>
      <span class="performer-stat">${p.completed}/${p.total}</span>
    </div>
  `).join('');
}

function renderRecurringTable(groups) {
  const tbody = document.getElementById('ana-recurring-table');
  if (!groups || groups.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No recurring issues detected in this period.</td></tr>';
    return;
  }

  console.log('Rendering recurring groups:', groups);

  tbody.innerHTML = groups.map((g, idx) => `
    <tr>
      <td><span title="${g.ncrNumbers}">${g.title}</span></td>
      <td><span class="badge badge-blue">${g.category}</span></td>
      <td><strong style="color:var(--accent3)">${g.occurrenceCount}</strong> times</td>
      <td><strong>${g.capaCount}</strong></td>
      <td><span class="badge badge-${capaAnalyticsGetStatusBadge(g.latestStatus)}">${g.latestStatus}</span></td>
      <td><button class="btn btn-sm btn-ghost" onclick="showRecurringNcrs(${idx})">View</button></td>
    </tr>
  `).join('');

  window.currentRecurringGroups = groups;
  currentRecurringGroups = groups;
}

function showRecurringNcrs(index) {
  console.log('========== showRecurringNcrs CALLED ==========');
  console.log('Index:', index);
  console.log('currentRecurringGroups:', currentRecurringGroups);

  const group = currentRecurringGroups[index];
  console.log('Group object:', JSON.stringify(group, null, 2));

  if (!group) {
    console.error('Group not found!');
    return;
  }

  const ncrs = group.relatedNcrs || [];
  console.log('Related NCRs:', JSON.stringify(ncrs, null, 2));

  if (ncrs.length === 0) {
    console.error('No related NCRs found!');
    alert('No related NCRs available for this issue.');
    return;
  }

  let modalContent = '<div style="padding: 20px;">';
  modalContent += `<h3 style="margin-bottom: 20px; color: var(--text-primary);">Related NCRs (${ncrs.length})</h3>`;

  ncrs.forEach((ncr, i) => {
    console.log(`Processing NCR ${i + 1}:`, JSON.stringify(ncr, null, 2));

    modalContent += `
      <div style="border: 2px solid var(--accent1); border-radius: 12px; padding: 20px; margin-bottom: 20px; background: var(--navy-light);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="margin: 0; color: var(--accent2);">NCR #${i + 1}</h4>
          <span style="background: var(--accent2); color: white; padding: 5px 12px; border-radius: 4px; font-size: 12px;">${ncr.status || 'Open'}</span>
        </div>
        <div style="margin-bottom: 10px;"><strong>Title:</strong> ${ncr.title || 'No title'}</div>
        <div style="margin-bottom: 10px; color: var(--text-muted);"><strong>Created:</strong> ${new Date(ncr.createdAt || ncr.date || Date.now()).toLocaleDateString()}</div>
        <div style="color: var(--text-muted);"><strong>Category:</strong> ${ncr.category || group.category || 'Uncategorized'}</div>
      </div>
    `;
  });

  modalContent += '</div>';

  console.log('Modal content generated');
  console.log('Setting modal content...');

  const modalTitle = document.getElementById('modal-title');
  const formFields = document.getElementById('form-fields');
  const recordForm = document.getElementById('record-form');
  const modalOverlay = document.getElementById('modal-overlay');

  console.log('modalTitle:', modalTitle);
  console.log('formFields:', formFields);
  console.log('recordForm:', recordForm);
  console.log('modalOverlay:', modalOverlay);

  if (modalTitle) modalTitle.textContent = `Recurring Issue: ${group.title || 'Unknown'}`;
  if (formFields) formFields.innerHTML = modalContent;
  const btn = document.querySelector('#record-form button[type="submit"]');
  if (btn) btn.style.display = 'none';
  if (modalOverlay) modalOverlay.classList.add('active');

  console.log('Modal should be visible now!');
}

function exportToPdf() {
  window.open(`${capaAnalyticsApiBaseUrl()}/dashboard/export/pdf`, '_blank');
}

function exportToExcel() {
  window.open(`${capaAnalyticsApiBaseUrl()}/dashboard/export/excel`, '_blank');
}

