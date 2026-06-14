function escapeHtml(value) {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStatusBadge(s) { const l = s.toLowerCase(); if(['approved','valid','complete','closed','completed','verified'].includes(l)) return 'green'; if(['in progress','due for review','expiring','under review','investigation','open','pending_verification'].includes(l)) return 'yellow'; if(['overdue','expired','suspended'].includes(l)) return 'red'; if(l==='scheduled') return 'blue'; return 'gray'; }

function getSeverityBadge(s) { 
  if(!s) return 'gray';
  const val = parseInt(s);
  if (!isNaN(val)) {
    if (val >= 20) return 'risk-extreme';
    if (val >= 15) return 'risk-crit';
    if (val >= 10) return 'risk-high';
    if (val >= 5) return 'risk-med';
    return 'risk-low';
  }
  const l = s.toString().toLowerCase(); 
  if (l.includes('e') || l.includes('d') || l === 'critical') return 'risk-crit';
  if (l.includes('c') || l === 'major') return 'risk-med';
  if (l.includes('b') || l === 'minor') return 'risk-low';
  return 'gray'; 
}

function getRiskBadge(s) { const l = s.toLowerCase(); return l==='high'?'red':(l==='medium'?'yellow':'gray'); }

function getPriorityBadge(p) {
  const l = p?.toLowerCase();
  return l === 'critical' ? 'red' : (l === 'high' ? 'orange' : (l === 'medium' ? 'yellow' : 'gray'));
}

function initialsFromName(name) {
  const n = (name || '').trim();
  if (!n) return 'U';
  return n.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'U';
}

function formatAckDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function formatDocumentVersionLabel(v) {
  const rev = v?.revision ? `Rev. ${v.revision}` : 'Revision';
  const suffix = v?.is_current ? ' (Current)' : (v?.snapshot_at ? ` (${new Date(v.snapshot_at).toLocaleDateString()})` : '');
  return `${rev}${suffix}`;
}

function showToast(message, type = 'info') {
  console.log(`[Toast] ${type}: ${message}`);
  alert(message);
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "Just now";
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

function formatAbsoluteTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function setActiveTabButton(clickedButton) {
  const nav = clickedButton?.closest?.('.tabs-nav');
  if (!nav) return;
  nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  clickedButton.classList.add('active');
}

function humanizeApprovalStatus(status) {
  const s = status ? String(status) : '';
  return s.replace(/_/g, ' ');
}

function badgeForApprovalStatus(status) {
  const s = status ? String(status) : '';
  if (s === 'approved') return 'green';
  if (s === 'rejected') return 'red';
  if (s === 'changes_requested') return 'orange';
  if (s === 'pending_approval' || s === 'pending') return 'yellow';
  return 'gray';
}
