function documentAnalyticsDeps() {
  return window.__documentAnalyticsDeps || {};
}

function documentAnalyticsApiBaseUrl() {
  return documentAnalyticsDeps().API_BASE_URL || '/api';
}

function documentAnalyticsEscapeHtml(value) {
  const fn = documentAnalyticsDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function documentAnalyticsGetStatusBadge(status) {
  const fn = documentAnalyticsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function documentAnalyticsInitialsFromName(name) {
  const fn = documentAnalyticsDeps().initialsFromName;
  return typeof fn === 'function' ? fn(name) : String(name || '').slice(0, 2).toUpperCase();
}

function documentAnalyticsStartReview(id) {
  const fn = documentAnalyticsDeps().startReview;
  if (typeof fn === 'function') return fn(id);
}

window.__docAnalytics = window.__docAnalytics || { charts: {}, lastCriticalDocs: [] };

function destroyChart(key) {
  const c = window.__docAnalytics.charts[key];
  if (c && typeof c.destroy === 'function') {
    try { c.destroy(); } catch {}
  }
  window.__docAnalytics.charts[key] = null;
}

function formatPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return String(Math.max(0, Math.min(100, Math.round(v))));
}

async function loadDocumentAnalytics() {
  const kpiWrap = document.getElementById('doc-analytics-kpis');
  if (!kpiWrap) return;
  const period = parseInt(document.getElementById('period')?.value || '30', 10) || 30;

  kpiWrap.innerHTML = '';
  const topDocsEl = document.getElementById('top-docs-list');
  const alertsBody = document.getElementById('doc-alerts-body');
  const ownersBody = document.getElementById('owner-performance-body');
  const healthLegend = document.getElementById('health-legend');
  const reviewCalendarEl = document.getElementById('review-calendar');
  if (topDocsEl) topDocsEl.innerHTML = '';
  if (alertsBody) alertsBody.innerHTML = '';
  if (ownersBody) ownersBody.innerHTML = '';
  if (healthLegend) healthLegend.innerHTML = '';
  if (reviewCalendarEl) reviewCalendarEl.innerHTML = '';

  try {
    const res = await fetch(`${documentAnalyticsApiBaseUrl()}/documents/analytics?period=${encodeURIComponent(String(period))}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || 'Failed');

    const k = data.kpis || {};
    const totalDocs = Number(k.total_docs || 0);
    const newThisMonth = Number(k.new_this_month || 0);
    const dueForReview = Number(k.due_for_review || 0);
    const expired = Number(k.expired || 0);
    const ackRate = Number(k.ack_rate || 0);
    const acknowledged = Number(k.acknowledged || 0);
    const required = Number(k.required || 0);
    const avgApprovalDays = Number(k.avg_approval_days || 0);
    const trendPct = Number(k.approval_trend_pct || 0);
    const trendClass = String(k.approval_trend_class || 'trend-up');
    const qrScans = Number(k.qr_scans || 0);
    const uniqueScanners = Number(k.unique_scanners || 0);

    kpiWrap.innerHTML = `
      <div class="stat-card" style="margin:0;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:34px; height:34px; border-radius:10px; background:rgba(59,139,255,0.12); display:flex; align-items:center; justify-content:center; font-size:16px;">📄</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800;">${documentAnalyticsEscapeHtml(String(totalDocs))}</div>
            <div class="stat-label" style="margin:2px 0 0;">Total Documents</div>
            <div style="margin-top:8px; font-size:12px; color:rgba(16,185,129,0.95); font-weight:800;">+${documentAnalyticsEscapeHtml(String(newThisMonth))} this month</div>
          </div>
        </div>
      </div>

      <div class="stat-card" style="margin:0; border-color: rgba(245,158,11,0.25);">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:34px; height:34px; border-radius:10px; background:rgba(245,158,11,0.14); display:flex; align-items:center; justify-content:center; font-size:16px;">⏰</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:#f59e0b;">${documentAnalyticsEscapeHtml(String(dueForReview))}</div>
            <div class="stat-label" style="margin:2px 0 0;">Due for Review</div>
            <div style="margin-top:8px; font-size:12px; color:var(--text-muted); font-weight:700;">in next 30 days</div>
          </div>
        </div>
      </div>

      <div class="stat-card" style="margin:0; border-color: rgba(239,68,68,0.25);">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:34px; height:34px; border-radius:10px; background:rgba(239,68,68,0.14); display:flex; align-items:center; justify-content:center; font-size:16px;">🔴</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:#ef4444;">${documentAnalyticsEscapeHtml(String(expired))}</div>
            <div class="stat-label" style="margin:2px 0 0;">Expired Documents</div>
            <button type="button" class="btn btn-ghost" style="margin-top:8px; padding:6px 10px; font-size:12px;" onclick="showPage('documents', null)">Take Action</button>
          </div>
        </div>
      </div>

      <div class="stat-card" style="margin:0;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:34px; height:34px; border-radius:10px; background:rgba(16,185,129,0.12); display:flex; align-items:center; justify-content:center; font-size:16px;">✅</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800;">${documentAnalyticsEscapeHtml(formatPct(ackRate))}%</div>
            <div class="stat-label" style="margin:2px 0 0;">Acknowledgment Rate</div>
            <div style="margin-top:8px; font-size:12px; color:var(--text-muted); font-weight:700;">${documentAnalyticsEscapeHtml(String(acknowledged))}/${documentAnalyticsEscapeHtml(String(required))} personnel</div>
          </div>
        </div>
      </div>

      <div class="stat-card" style="margin:0;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:34px; height:34px; border-radius:10px; background:rgba(0,210,255,0.12); display:flex; align-items:center; justify-content:center; font-size:16px;">⏱</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800;">${documentAnalyticsEscapeHtml(String(avgApprovalDays))} days</div>
            <div class="stat-label" style="margin:2px 0 0;">Avg. Approval Time</div>
            <div style="margin-top:8px; font-size:12px; font-weight:800; color:${trendClass === 'trend-up' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)'};">${documentAnalyticsEscapeHtml(String(trendPct))}% vs last period</div>
          </div>
        </div>
      </div>

      <div class="stat-card" style="margin:0;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:34px; height:34px; border-radius:10px; background:rgba(59,139,255,0.12); display:flex; align-items:center; justify-content:center; font-size:16px;">📱</div>
          <div style="flex:1;">
            <div style="font-family:'Syne',sans-serif; font-size:28px; font-weight:800;">${documentAnalyticsEscapeHtml(String(qrScans))}</div>
            <div class="stat-label" style="margin:2px 0 0;">QR Scans This Month</div>
            <div style="margin-top:8px; font-size:12px; color:var(--text-muted); font-weight:700;">${documentAnalyticsEscapeHtml(String(uniqueScanners))} unique scanners</div>
          </div>
        </div>
      </div>
    `;

    const dist = data.health_distribution || {};
    const approvedCount = Number(dist.approved || 0);
    const reviewCount = Number(dist.due_for_review || 0);
    const expiredCount = Number(dist.expired || 0);
    const draftCount = Number(dist.draft || 0);

    if (healthLegend) {
      healthLegend.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px;"><span style="display:flex; align-items:center; gap:8px;"><span style="width:10px; height:10px; border-radius:999px; background:#10b981;"></span>Approved</span><span>${documentAnalyticsEscapeHtml(String(approvedCount))}</span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px;"><span style="display:flex; align-items:center; gap:8px;"><span style="width:10px; height:10px; border-radius:999px; background:#f59e0b;"></span>Due for Review</span><span>${documentAnalyticsEscapeHtml(String(reviewCount))}</span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px;"><span style="display:flex; align-items:center; gap:8px;"><span style="width:10px; height:10px; border-radius:999px; background:#ef4444;"></span>Expired</span><span>${documentAnalyticsEscapeHtml(String(expiredCount))}</span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px;"><span style="display:flex; align-items:center; gap:8px;"><span style="width:10px; height:10px; border-radius:999px; background:#6b7280;"></span>Draft</span><span>${documentAnalyticsEscapeHtml(String(draftCount))}</span></div>
      `;
    }

    destroyChart('health');
    const healthCtx = document.getElementById('health-donut-chart')?.getContext?.('2d');
    if (healthCtx && window.Chart) {
      window.__docAnalytics.charts.health = new Chart(healthCtx, {
        type: 'doughnut',
        data: {
          labels: ['Approved', 'Due for Review', 'Expired', 'Draft'],
          datasets: [{
            data: [approvedCount, reviewCount, expiredCount, draftCount],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
            borderColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          cutout: '62%'
        }
      });
    }

    const reviewCalendar = Array.isArray(data.review_calendar) ? data.review_calendar : [];
    if (reviewCalendarEl) {
      const now = new Date();
      const month0 = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthCounts = new Map(reviewCalendar.map(x => [`${x.year}-${String(x.month).padStart(2, '0')}`, Number(x.count || 0)]));
      const max = Math.max(1, ...Array.from(monthCounts.values()));
      const blocks = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(month0.getFullYear(), month0.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const count = monthCounts.get(key) || 0;
        const alpha = Math.max(0.08, Math.min(0.9, count / max));
        const bg = `rgba(59,139,255,${alpha})`;
        const label = d.toLocaleString(undefined, { month: 'short' });
        blocks.push(`
          <div style="border:1px solid var(--border); border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.02);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="font-weight:900; font-size:12px;">${documentAnalyticsEscapeHtml(label)} ${documentAnalyticsEscapeHtml(String(d.getFullYear()))}</div>
              <div style="font-weight:900; font-size:12px; color:rgba(238,242,247,0.85);">${documentAnalyticsEscapeHtml(String(count))}</div>
            </div>
            <div style="height:8px; margin-top:10px; border-radius:999px; background: rgba(255,255,255,0.06); overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
              <div style="height:100%; width:${documentAnalyticsEscapeHtml(String(Math.round((count / max) * 100)))}%; background:${bg};"></div>
            </div>
          </div>
        `);
      }
      reviewCalendarEl.innerHTML = blocks.join('');
    }

    const mostAccessed = Array.isArray(data.most_accessed) ? data.most_accessed : [];
    if (topDocsEl) {
      if (mostAccessed.length === 0) {
        topDocsEl.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">No access data for this period.</div>';
      } else {
        topDocsEl.innerHTML = mostAccessed.map(d => `
          <div style="display:flex; gap:12px; align-items:center; padding: 10px; border:1px solid rgba(255,255,255,0.06); border-radius: 12px; background: rgba(255,255,255,0.02); margin-bottom: 10px;">
            <div style="width:28px; text-align:center; color:var(--text-muted); font-weight:900;">#${documentAnalyticsEscapeHtml(String(d.rank || ''))}</div>
            <div style="min-width:0; flex:1;">
              <a href="#" onclick="event.preventDefault(); viewDocument(${Number(d.id)});" style="color:var(--accent2); font-weight:900; text-decoration:none;">${documentAnalyticsEscapeHtml(String(d.doc_number || ''))}</a>
              <div style="font-size:12px; color:var(--text-muted); overflow:hidden; white-space:nowrap; text-overflow:ellipsis;" title="${documentAnalyticsEscapeHtml(String(d.title || ''))}">${documentAnalyticsEscapeHtml(String(d.title || ''))}</div>
              <div style="height:8px; margin-top:8px; border-radius:999px; background: rgba(255,255,255,0.06); overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
                <div style="height:100%; width:${documentAnalyticsEscapeHtml(String(d.pct || 0))}%; background: rgba(59,139,255,0.85);"></div>
              </div>
            </div>
            <div style="white-space:nowrap; font-size:12px; color:rgba(238,242,247,0.85); font-weight:800;">${documentAnalyticsEscapeHtml(String(d.count || 0))} views</div>
          </div>
        `).join('');
      }
    }

    const approvalByCategory = Array.isArray(data.approval_time_by_category) ? data.approval_time_by_category : [];
    destroyChart('approvalByCategory');
    const approvalCtx = document.getElementById('approval-time-chart')?.getContext?.('2d');
    if (approvalCtx && window.Chart) {
      window.__docAnalytics.charts.approvalByCategory = new Chart(approvalCtx, {
        type: 'bar',
        data: {
          labels: approvalByCategory.map(x => String(x.category || '')),
          datasets: [{
            label: 'Days',
            data: approvalByCategory.map(x => Number(x.avg_days || 0)),
            backgroundColor: 'rgba(0,210,255,0.55)',
            borderColor: 'rgba(0,210,255,0.95)',
            borderWidth: 1
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'rgba(238,242,247,0.8)' }, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { ticks: { color: 'rgba(238,242,247,0.8)' }, grid: { color: 'rgba(255,255,255,0.06)' } }
          }
        }
      });
    }

    const docsByCategory = Array.isArray(data.documents_by_category) ? data.documents_by_category : [];
    destroyChart('docsByCategory');
    const catCtx = document.getElementById('category-chart')?.getContext?.('2d');
    if (catCtx && window.Chart) {
      window.__docAnalytics.charts.docsByCategory = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: docsByCategory.map(x => String(x.category || '')),
          datasets: [{
            data: docsByCategory.map(x => Number(x.count || 0)),
            backgroundColor: docsByCategory.map((_, i) => `rgba(59,139,255,${0.25 + (i % 6) * 0.1})`),
            borderColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          cutout: '60%'
        }
      });
    }

    const critical = Array.isArray(data.critical_docs) ? data.critical_docs : [];
    window.__docAnalytics.lastCriticalDocs = critical;
    if (alertsBody) {
      if (critical.length === 0) {
        alertsBody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">No critical documents in this period.</td></tr>';
      } else {
        alertsBody.innerHTML = critical.map(d => {
          const sev = String(d.severity || 'info');
          const rowBg = sev === 'danger' ? 'rgba(239,68,68,0.08)' : (sev === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(59,139,255,0.06)');
          const days = Number(d.days || 0);
          const daysLabel = (d.is_expired || days < 0) ? `${Math.abs(days)} days overdue` : `${days} days left`;
          const daysColor = (d.is_expired || days < 0) ? 'rgba(239,68,68,0.95)' : (days <= 7 ? 'rgba(245,158,11,0.95)' : 'rgba(238,242,247,0.85)');
          return `
            <tr style="background:${rowBg};">
              <td><a href="#" onclick="event.preventDefault(); viewDocument(${Number(d.id)});" style="color:var(--accent2); font-weight:800; text-decoration:none;">${documentAnalyticsEscapeHtml(String(d.doc_number || ''))}</a></td>
              <td>${documentAnalyticsEscapeHtml(String(d.title || ''))}</td>
              <td><span class="badge badge-blue">${documentAnalyticsEscapeHtml(String(d.category || ''))}</span></td>
              <td>${documentAnalyticsEscapeHtml(String(d.owner || ''))}</td>
              <td><span class="badge badge-${documentAnalyticsGetStatusBadge(String(d.status || ''))}">${documentAnalyticsEscapeHtml(String(d.status || ''))}</span></td>
              <td style="font-weight:900; color:${daysColor};">${documentAnalyticsEscapeHtml(daysLabel)}</td>
              <td><button type="button" class="btn btn-primary" style="padding:6px 10px; font-size:12px;" onclick="initiateReview(${Number(d.id)})">Start Review</button></td>
            </tr>
          `;
        }).join('');
      }
    }

    const owners = Array.isArray(data.owner_performance) ? data.owner_performance : [];
    if (ownersBody) {
      if (owners.length === 0) {
        ownersBody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);">No owner data.</td></tr>';
      } else {
        ownersBody.innerHTML = owners.map(o => {
          const overdue = Number(o.overdue || 0);
          const score = Number(o.score || 0);
          const badge = score >= 85 ? 'green' : (score >= 65 ? 'yellow' : 'red');
          return `
            <tr>
              <td><div style="display:flex; align-items:center; gap:10px;"><div class="avatar-xs">${documentAnalyticsEscapeHtml(documentAnalyticsInitialsFromName(String(o.owner || '')))}</div><span style="font-weight:800;">${documentAnalyticsEscapeHtml(String(o.owner || ''))}</span></div></td>
              <td>${documentAnalyticsEscapeHtml(String(o.total || 0))}</td>
              <td style="${overdue > 0 ? 'color:rgba(239,68,68,0.95); font-weight:900;' : ''}">${documentAnalyticsEscapeHtml(String(overdue))}</td>
              <td>${documentAnalyticsEscapeHtml(String(o.on_time_rate || 0))}%</td>
              <td>${documentAnalyticsEscapeHtml(String(o.avg_approval_days || 0))} days</td>
              <td><span class="badge badge-${badge}">${documentAnalyticsEscapeHtml(String(score))}/100</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch {
    kpiWrap.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading analytics.</div>';
  }
}

function exportAlerts() {
  const rows = Array.isArray(window.__docAnalytics.lastCriticalDocs) ? window.__docAnalytics.lastCriticalDocs : [];
  const header = ['doc_number', 'title', 'category', 'owner', 'status', 'days', 'is_expired'];
  const csv = [header.join(',')].concat(rows.map(r => header.map(k => {
    const v = r?.[k];
    const s = v == null ? '' : String(v).replace(/"/g, '""');
    return `"${s}"`;
  }).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document_alerts.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initiateReview(id) {
  documentAnalyticsStartReview(id);
}

