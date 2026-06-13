function myReviewTasksDeps() {
  return window.__myReviewTasksDeps || {};
}

function myReviewTasksApiBaseUrl() {
  return myReviewTasksDeps().API_BASE_URL || '/api';
}

function myReviewTasksEscapeHtml(value) {
  const fn = myReviewTasksDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function myReviewTasksShowPage(id, el) {
  const fn = myReviewTasksDeps().showPage;
  if (typeof fn === 'function') return fn(id, el);
}

function myReviewTasksViewDocument(id) {
  const fn = myReviewTasksDeps().viewDocument;
  if (typeof fn === 'function') return fn(id);
}

async function loadMyReviewTasks() {
  const tbody = document.getElementById('my-review-tasks-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">Loading...</td></tr>';
  try {
    const res = await fetch(`${myReviewTasksApiBaseUrl()}/reviews/my-tasks?_=${Date.now()}`, { cache: 'no-store' });
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
            <div style="font-weight:800;">${myReviewTasksEscapeHtml(t.document_number || '')}</div>
            <div style="color:var(--text-muted); font-size:12px;">${myReviewTasksEscapeHtml(t.title || '')}</div>
          </td>
          <td>${myReviewTasksEscapeHtml(t.category || '')}</td>
          <td>${myReviewTasksEscapeHtml(t.owner || '')}</td>
          <td>${t.review_date ? new Date(t.review_date).toLocaleDateString() : '-'}</td>
          <td>${myReviewTasksEscapeHtml(dueLabel)}</td>
          <td><span class="badge badge-${badge}">${myReviewTasksEscapeHtml(t.urgency || '')}</span></td>
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
  await myReviewTasksShowPage('documents', null);
  await myReviewTasksViewDocument(documentId);
}
