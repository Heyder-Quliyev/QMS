function myActionsDeps() {
  return window.__myActionsDeps || {};
}

function myActionsApiBaseUrl() {
  return myActionsDeps().API_BASE_URL || '/api';
}

function myActionsEscapeHtml(value) {
  const fn = myActionsDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function myActionsGetPriorityBadge(priority) {
  const fn = myActionsDeps().getPriorityBadge;
  return typeof fn === 'function' ? fn(priority) : 'gray';
}

function myActionsGetStatusBadge(status) {
  const fn = myActionsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

function myActionsViewCapa(id) {
  const fn = myActionsDeps().viewCapa;
  if (typeof fn === 'function') return fn(id);
}

function myActionsViewNCR(id) {
  const fn = myActionsDeps().viewNCR;
  if (typeof fn === 'function') return fn(id);
}

function myActionsShowToast(message, type = 'info') {
  const fn = myActionsDeps().showToast;
  if (typeof fn === 'function') return fn(message, type);
  console.log(`[Toast] ${type}: ${message}`);
}

async function myActionsRefreshAfterDrop() {
  const fetchMyActions = myActionsDeps().fetchMyActions;
  if (typeof fetchMyActions === 'function') {
    return fetchMyActions();
  }
  const fetchCapas = myActionsDeps().fetchCapas;
  if (typeof fetchCapas === 'function') {
    return fetchCapas();
  }
}

let allMyActions = [];
let draggedCard = null;

async function loadMyActions() {
  try {
    const res = await fetch(`${myActionsApiBaseUrl()}/capa/my-actions?userId=1`);
    allMyActions = await res.json();
    updateMyActionsSummary(allMyActions);
    applyMyActionsFilters();
  } catch (error) {
    console.error('Failed to load my actions:', error);
  }
}

function updateMyActionsSummary(actions) {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  document.getElementById('total-count').textContent = actions.length;
  document.getElementById('overdue-count').textContent = actions.filter(a => new Date(a.dueDate) < now && a.status !== 'closed' && a.status !== 'verified').length;
  document.getElementById('due-week-count').textContent = actions.filter(a => {
    const d = new Date(a.dueDate);
    return d >= now && d <= nextWeek;
  }).length;
  document.getElementById('pending-verification-count').textContent = actions.filter(a => a.status === 'pending_verification').length;
}

function applyMyActionsFilters() {
  const status = document.getElementById('status-filter').value;
  const priority = document.getElementById('priority-filter').value;
  const overdueOnly = document.getElementById('overdue-only').checked;
  const now = new Date();

  let filtered = allMyActions;
  if (status !== 'all') filtered = filtered.filter(a => a.status === status);
  if (priority !== 'all') filtered = filtered.filter(a => a.priority === priority);
  if (overdueOnly) filtered = filtered.filter(a => new Date(a.dueDate) < now && a.status !== 'closed' && a.status !== 'verified');

  renderMyActionCards(filtered);
}

function renderMyActionCards(actions) {
  const container = document.getElementById('actions-list');
  const emptyState = document.getElementById('empty-state');

  if (actions.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'grid';
  emptyState.style.display = 'none';

  container.innerHTML = actions.map(a => `
    <div class="action-card" onclick="viewCapa('${myActionsEscapeHtml(String(a.id || ''))}')">
      <div class="card-header">
        <div>
          <div class="card-title">${myActionsEscapeHtml(String(a.title || ''))}</div>
          <div class="ncr-context">From NCR: <a href="#" onclick="event.stopPropagation(); viewNCR(${a.ncrId})">${myActionsEscapeHtml(String(a.ncrNumber || ''))}</a></div>
        </div>
        <span class="badge badge-${myActionsGetPriorityBadge(a.priority)}">${myActionsEscapeHtml(String(a.priority || ''))}</span>
      </div>
      <div class="card-body">${myActionsEscapeHtml(String(a.description || ''))}</div>
      <div class="card-footer">
        <div class="footer-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          <span class="badge badge-${myActionsGetStatusBadge(a.status)}">${myActionsEscapeHtml(String((a.status || '').toString().replace('_', ' ')))}</span>
        </div>
        <div class="footer-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Due: ${new Date(a.dueDate).toLocaleDateString()}
        </div>
      </div>
    </div>
  `).join('');
}

function switchMyActionsView(view, btn) {
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (view === 'kanban') {
    document.getElementById('actions-list').style.display = 'none';
    document.getElementById('kanban-view').style.display = 'flex';
    loadKanbanData();
  } else {
    document.getElementById('actions-list').style.display = 'block';
    document.getElementById('kanban-view').style.display = 'none';
  }

  localStorage.setItem('capa-view-preference', view);
}

function renderKanbanCard(capa) {
  const priorityClass = capa.priority ? `priority-${capa.priority.toLowerCase()}` : 'priority-medium';
  const actionTypeShort = capa.actionType ? (capa.actionType === 'corrective' ? 'Corr' : 'Prev') : 'Act';
  const badgeType = capa.actionType === 'corrective' ? 'danger' : 'info';
  const dueDate = capa.dueDate ? new Date(capa.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date();
  const dueDateShort = dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const ncrNumber = capa.ncrNumber || (capa.NCRId ? `NCR-${capa.NCRId}` : '');
  const initials = (capa.responsiblePersonName || 'U').substring(0, 2).toUpperCase();

  return `
    <div class="kanban-card" data-capa-id="${capa.id}" draggable="true" onclick="handleKanbanCardClick('${capa.id}')">
      <div class="card-badges">
        <span class="badge badge-${badgeType}">${actionTypeShort}</span>
        <span class="priority-dot ${priorityClass}"></span>
      </div>
      <h4 class="card-title">${myActionsEscapeHtml(String(capa.title || ''))}</h4>
      <div class="card-meta">
        <div class="ncr-ref">
          <small>${myActionsEscapeHtml(String(ncrNumber || ''))}</small>
        </div>
        <div class="due-date ${isOverdue ? 'overdue' : ''}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <small>${dueDateShort}</small>
        </div>
      </div>
      <div class="card-footer">
        <div class="avatar-xs" style="background:var(--accent2); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; color:white;">${initials}</div>
      </div>
    </div>
  `;
}

function handleKanbanCardClick(capaId) {
  console.log('handleKanbanCardClick called with:', capaId);
  if (capaId) {
    myActionsViewCapa(capaId);
  }
}

async function loadKanbanData() {
  try {
    const response = await fetch(`${myActionsApiBaseUrl()}/capa`);
    const data = await response.json();

    const grouped = {
      not_started: [],
      in_progress: [],
      pending_verification: [],
      verified: []
    };

    data.forEach(capa => {
      if (grouped[capa.status]) {
        grouped[capa.status].push(capa);
      }
    });

    const statusMap = {
      not_started: 'column-not-started',
      in_progress: 'column-in-progress',
      pending_verification: 'column-pending-verification',
      verified: 'column-verified'
    };

    Object.keys(grouped).forEach(status => {
      const columnId = statusMap[status];
      const column = document.getElementById(columnId);
      if (column) {
        column.innerHTML = grouped[status].map(capa => renderKanbanCard(capa)).join('');
      }
    });

    updateColumnCounts();
    initKanban();
  } catch (error) {
    console.error('Failed to load kanban data:', error);
  }
}

function initKanban() {
  console.log('initKanban called');

  const columns = document.querySelectorAll('.column-body');
  console.log('Found columns:', columns.length);

  columns.forEach(column => {
    column.addEventListener('dragover', handleDragOver);
    column.addEventListener('dragenter', handleDragEnter);
    column.addEventListener('dragleave', handleDragLeave);
    column.addEventListener('drop', handleDrop);
  });

  const cards = document.querySelectorAll('.kanban-card');
  console.log('Found cards:', cards.length);

  cards.forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  console.log('handleDragStart');
  draggedCard = e.target.closest('.kanban-card');
  if (!draggedCard) return;

  e.dataTransfer.setData('text/plain', draggedCard.dataset.capaId);
  e.dataTransfer.effectAllowed = 'move';
  draggedCard.classList.add('card-dragging');

  setTimeout(() => {
    if (draggedCard) {
      draggedCard.style.opacity = '0.1';
    }
  }, 0);
}

function handleDragEnd() {
  console.log('handleDragEnd');
  if (draggedCard) {
    draggedCard.classList.remove('card-dragging');
    draggedCard.style.opacity = '1';
    draggedCard = null;
  }

  document.querySelectorAll('.column-body').forEach(col => {
    col.classList.remove('card-ghost');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  const column = e.target.closest('.column-body');
  if (column) {
    column.classList.add('card-ghost');
  }
}

function handleDragLeave(e) {
  const column = e.target.closest('.column-body');
  if (column && !column.contains(e.relatedTarget)) {
    column.classList.remove('card-ghost');
  }
}

async function handleDrop(e) {
  e.preventDefault();
  console.log('handleDrop');

  const cardId = e.dataTransfer.getData('text/plain');
  if (!cardId || !draggedCard) {
    console.log('No cardId or draggedCard');
    return;
  }

  const newColumn = e.target.closest('.column-body');
  if (!newColumn) {
    console.log('No newColumn');
    return;
  }

  const kanbanColumn = newColumn.closest('.kanban-column');
  if (!kanbanColumn) {
    console.log('No kanbanColumn');
    return;
  }

  const newStatus = kanbanColumn.dataset.status;
  const oldColumn = draggedCard.closest('.column-body');
  const oldKanbanColumn = oldColumn?.closest('.kanban-column');
  const oldStatus = oldKanbanColumn?.dataset.status;

  console.log('Moving from:', oldStatus, 'to:', newStatus);

  if (!canTransition(oldStatus, newStatus)) {
    myActionsShowToast('Invalid status transition', 'error');
    newColumn.classList.remove('card-ghost');
    return;
  }

  try {
    newColumn.appendChild(draggedCard);
    draggedCard.dataset.currentStatus = newStatus;
    newColumn.classList.remove('card-ghost');
    updateColumnCounts();

    console.log('Fetching existing CAPA to update...');
    const getRes = await fetch(`${myActionsApiBaseUrl()}/capa/${cardId}`);
    const existingCapa = await getRes.json();

    const capaAction = {
      Id: cardId,
      id: cardId,
      Title: existingCapa.Title || existingCapa.title || '',
      title: existingCapa.Title || existingCapa.title || '',
      Description: existingCapa.Description || existingCapa.description || '',
      description: existingCapa.Description || existingCapa.description || '',
      ActionType: existingCapa.ActionType || existingCapa.actionType || '',
      actionType: existingCapa.ActionType || existingCapa.actionType || '',
      ResponsiblePersonId: existingCapa.ResponsiblePersonId || existingCapa.responsiblePersonId || 0,
      responsiblePersonId: existingCapa.ResponsiblePersonId || existingCapa.responsiblePersonId || 0,
      ResponsiblePersonName: existingCapa.ResponsiblePersonName || existingCapa.responsiblePersonName || '',
      responsiblePersonName: existingCapa.ResponsiblePersonName || existingCapa.responsiblePersonName || '',
      ResponsiblePersonEmail: existingCapa.ResponsiblePersonEmail || existingCapa.responsiblePersonEmail || '',
      responsiblePersonEmail: existingCapa.ResponsiblePersonEmail || existingCapa.responsiblePersonEmail || '',
      DueDate: existingCapa.DueDate || existingCapa.dueDate || new Date().toISOString(),
      dueDate: existingCapa.DueDate || existingCapa.dueDate || new Date().toISOString(),
      Priority: existingCapa.Priority || existingCapa.priority || 'medium',
      priority: existingCapa.Priority || existingCapa.priority || 'medium',
      Status: newStatus,
      status: newStatus,
      NCRId: existingCapa.NCRId || existingCapa.ncrId || null,
      ncrId: existingCapa.NCRId || existingCapa.ncrId || null,
      CreatedAt: existingCapa.CreatedAt || existingCapa.createdAt || new Date().toISOString(),
      createdAt: existingCapa.CreatedAt || existingCapa.createdAt || new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      AssignedDate: existingCapa.AssignedDate || existingCapa.assignedDate || new Date().toISOString(),
      assignedDate: existingCapa.AssignedDate || existingCapa.assignedDate || new Date().toISOString()
    };

    console.log('Sending update request with:', capaAction);

    const res = await fetch(`${myActionsApiBaseUrl()}/capa/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capaAction)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Update failed:', errText);
      throw new Error('Update failed');
    }

    console.log('Update successful, refreshing...');
    myActionsShowToast('Status updated', 'success');
    await myActionsRefreshAfterDrop();
  } catch (error) {
    console.error('Failed to update status:', error);
    if (oldColumn && draggedCard) {
      oldColumn.appendChild(draggedCard);
      updateColumnCounts();
    }
    myActionsShowToast('Failed to update status', 'error');
  }
}

function canTransition(currentStatus, newStatus) {
  const allowedTransitions = {
    not_started: ['in_progress'],
    in_progress: ['pending_verification', 'not_started'],
    pending_verification: ['verified', 'in_progress'],
    verified: ['pending_verification']
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) || false;
}

function updateColumnCounts() {
  document.querySelectorAll('.kanban-column').forEach(column => {
    const count = column.querySelectorAll('.kanban-card').length;
    column.querySelector('.column-count').textContent = count;
  });
}

