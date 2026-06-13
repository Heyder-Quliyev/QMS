function checkListsDeps() {
  return window.__checkListsDeps || {};
}

function checkListsApiBaseUrl() {
  return checkListsDeps().API_BASE_URL || '/api';
}

async function fetchChecklists() {
  const res = await fetch(`${checkListsApiBaseUrl()}/checklists`);
  const data = await res.json();
  if (data.length > 0) {
    const active = data[0];
    document.querySelector('#page-checklists .panel-title').textContent = active.title;
    document.getElementById('checklist-items').innerHTML = active.items.map(item => `<div class="check-item"><div class="check-box ${item.isCompleted ? 'checked' : ''}" onclick="toggleCheck(this, ${item.id})"><svg viewBox="0 0 12 12" fill="none" stroke="#0a1628" stroke-width="2.5"><polyline points="2 6 5 9 10 3"/></svg></div><span class="check-text ${item.isCompleted ? 'done' : ''}">${item.description}</span></div>`).join('');
    updateProgress();
  }
}

function toggleCheck(box) {
  box.classList.toggle('checked');
  box.nextElementSibling.classList.toggle('done');
  updateProgress();
}

function updateProgress() {
  const t = document.querySelectorAll('.check-box').length;
  const d = document.querySelectorAll('.check-box.checked').length;
  document.getElementById('check-progress').style.width = ((d / t) * 100) + '%';
  document.getElementById('check-label').textContent = `${d} / ${t} complete`;
}

