function dashboardDeps() {
  return window.__dashboardDeps || {};
}

function dashboardApiBaseUrl() {
  return dashboardDeps().API_BASE_URL || '/api';
}

function dashboardEscapeHtml(value) {
  const fn = dashboardDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function dashboardViewCapa(id) {
  const fn = dashboardDeps().viewCapa;
  if (typeof fn === 'function') return fn(id);
}

let capaStatusChart = null;

async function loadCapaDashboard() {
  try {
    const res = await fetch(`${dashboardApiBaseUrl()}/dashboard/capa-stats`);
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
            <strong>${dashboardEscapeHtml(String(a.title || ''))}</strong>
            <small>Due ${dashboardEscapeHtml(String(a.dueDateRelative || ''))}</small>
          </div>
          <button class="btn-sm" onclick="viewCapa('${dashboardEscapeHtml(String(a.id || ''))}')" style="padding:2px 8px; font-size:10px;">View</button>
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
