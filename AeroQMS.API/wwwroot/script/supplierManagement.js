function supplierManagementDeps() {
  return window.__supplierManagementDeps || {};
}

function supplierManagementApiBaseUrl() {
  return supplierManagementDeps().API_BASE_URL || '/api';
}

function supplierManagementGetStatusBadge(s) {
  const fn = supplierManagementDeps().getStatusBadge;
  return typeof fn === 'function' ? fn(s) : 'gray';
}

async function fetchSuppliers() {
  const res = await fetch(`${supplierManagementApiBaseUrl()}/suppliers`);
  const data = await res.json();
  document.querySelector('#page-suppliers tbody').innerHTML = data.map(s => `<tr><td>${s.name}</td><td>${s.category}</td><td>${s.country}</td><td>${s.rating}</td><td>${s.lastAudit}</td><td><span class="badge badge-${supplierManagementGetStatusBadge(s.status)}">${s.status}</span></td></tr>`).join('');
}
