function trainingRecordsDeps() {
  return window.__trainingRecordsDeps || {};
}

function trainingApiBaseUrl() {
  return trainingRecordsDeps().API_BASE_URL || '/api';
}

function trainingGetStatusBadge(status) {
  const fn = trainingRecordsDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(status) : 'gray';
}

async function fetchTraining() {
  const res = await fetch(`${trainingApiBaseUrl()}/training`);
  const data = await res.json();
  document.querySelector('#page-training tbody').innerHTML = data.map(t => `
    <tr>
      <td>${t.staffMember}</td>
      <td>${t.course}</td>
      <td><span class="badge badge-blue">${t.category}</span></td>
      <td>${new Date(t.completionDate).toLocaleDateString()}</td>
      <td>${new Date(t.expiryDate).toLocaleDateString()}</td>
      <td><span class="badge badge-${trainingGetStatusBadge(t.status)}">${t.status}</span></td>
    </tr>
  `).join('');
}

