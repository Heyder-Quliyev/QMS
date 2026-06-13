function riskManagementDeps() {
  return window.__riskManagementDeps || {};
}

function riskApiBaseUrl() {
  return riskManagementDeps().API_BASE_URL || '/api';
}

function riskGetBadge(level) {
  const fn = riskManagementDeps().getRiskBadge;
  return typeof fn === 'function' ? fn(level) : 'gray';
}

async function fetchRisks() {
  const res = await fetch(`${riskApiBaseUrl()}/risks`);
  const data = await res.json();
  document.querySelector('#page-risk tbody').innerHTML = data.map(r => `
    <tr>
      <td>${r.riskId}</td>
      <td>${r.description}</td>
      <td>${r.category}</td>
      <td>${r.likelihood}</td>
      <td>${r.severity}</td>
      <td><span class="badge badge-${riskGetBadge(r.riskLevel)}">${r.riskLevel}</span></td>
      <td>${r.owner}</td>
    </tr>
  `).join('');
}

