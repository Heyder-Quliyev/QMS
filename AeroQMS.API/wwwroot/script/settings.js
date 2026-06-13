function settingsDeps() {
  return window.__settingsDeps || {};
}

function settingsApiBaseUrl() {
  return settingsDeps().API_BASE_URL || '/api';
}

function settingsEscapeHtml(value) {
  const fn = settingsDeps().escapeHtml;
  return typeof fn === 'function' ? fn(value) : String(value ?? '');
}

function settingsShowToast(message, type = 'info') {
  const fn = settingsDeps().showToast;
  if (typeof fn === 'function') return fn(message, type);
}

function getReviewAutomationDraft() {
  window.reviewAutomationDraft = window.reviewAutomationDraft || { category_rules: [], notification_rules: [], escalation_rules: [] };
  return window.reviewAutomationDraft;
}

function setReviewAutomationDraft(nextValue) {
  window.reviewAutomationDraft = nextValue || { category_rules: [], notification_rules: [], escalation_rules: [] };
  return window.reviewAutomationDraft;
}

setReviewAutomationDraft(getReviewAutomationDraft());

function normalizeAutomationRoleValue(v) {
  const s = (v || '').trim();
  if (!s) return '';
  return s;
}

function renderAutomationEditor() {
  const root = document.getElementById('review-automation-editor');
  if (!root) return;

  const data = getReviewAutomationDraft();
  const categoryRules = Array.isArray(data.category_rules) ? data.category_rules : [];
  const notifRules = Array.isArray(data.notification_rules) ? data.notification_rules : [];
  const escalationRules = Array.isArray(data.escalation_rules) ? data.escalation_rules : [];

  const safeInt = (value, fallback) => {
    const n = parseInt((value ?? '').toString(), 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const roleOptions = ['Document Owner', 'Quality Manager', 'Department Head', 'Admin'];
  const cycleOptions = [
    { label: '6 months', months: 6 },
    { label: '12 months', months: 12 },
    { label: '24 months', months: 24 }
  ];
  const warningOptions = [
    { label: '60 days before', days: 60 },
    { label: '30 days before', days: 30 },
    { label: '7 days before', days: 7 }
  ];

  root.innerHTML = `
    <div style="margin-bottom: 18px;">
      <h4 style="margin: 0 0 10px;">Default Review Cycles by Category</h4>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Review Cycle</th>
              <th>Warning Period</th>
              <th>Auto-Assign To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRules.map((r, idx) => `
              <tr>
                <td><input class="form-input" style="height: 34px;" type="text" value="${settingsEscapeHtml(r.category || '')}" oninput="updateAutomationCategoryRule(${idx}, 'category', this.value)"></td>
                <td>
                  <select class="form-input" style="height: 34px;" onchange="updateAutomationCategoryRule(${idx}, 'review_cycle_months', this.value)">
                    ${cycleOptions.map(o => `<option value="${o.months}" ${(parseInt(r.review_cycle_months, 10) || 12) === o.months ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <select class="form-input" style="height: 34px;" onchange="updateAutomationCategoryRule(${idx}, 'warning_days', this.value)">
                    ${warningOptions.map(o => `<option value="${o.days}" ${(parseInt(r.warning_days, 10) || 30) === o.days ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <select class="form-input" style="height: 34px;" onchange="updateAutomationCategoryRule(${idx}, 'auto_assign_to', this.value)">
                    ${roleOptions.map(o => `<option value="${settingsEscapeHtml(o)}" ${(normalizeAutomationRoleValue(r.auto_assign_to) || 'Document Owner') === o ? 'selected' : ''}>${settingsEscapeHtml(o)}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <button type="button" class="btn btn-ghost" style="padding:6px 10px;" onclick="removeAutomationCategoryRule(${idx})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-ghost" style="margin-top: 10px;" onclick="addAutomationCategoryRule()">+ Add Category Rule</button>
    </div>

    <div style="margin-bottom: 18px;">
      <h4 style="margin: 0 0 10px;">Automated Notification Schedule</h4>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>When document is</th>
              <th>Send email to</th>
              <th>Email template</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${notifRules.map((r, idx) => `
              <tr>
                <td>
                  <select class="form-input" style="height: 34px;" onchange="updateAutomationNotificationRule(${idx}, 'trigger', this.value)">
                    ${[
                      { v: '60', t: '60 days before expiry' },
                      { v: '30', t: '30 days before expiry' },
                      { v: '7', t: '7 days before expiry' },
                      { v: '0', t: 'On expiry date' },
                      { v: 'overdue_weekly', t: 'Overdue (weekly)' }
                    ].map(o => `<option value="${o.v}" ${(String(r.trigger || '30') === o.v) ? 'selected' : ''}>${o.t}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    ${roleOptions.map(o => {
                      const selected = Array.isArray(r.recipients) && r.recipients.includes(o);
                      return `
                        <label class="checkbox-label" style="margin:0;">
                          <input type="checkbox" ${selected ? 'checked' : ''} onchange='toggleAutomationNotificationRecipient(${idx}, ${JSON.stringify(o)}, this.checked)'>
                          <span>${settingsEscapeHtml(o)}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </td>
                <td>
                  <select class="form-input" style="height: 34px;" onchange="updateAutomationNotificationRule(${idx}, 'template', this.value)">
                    ${['Review Reminder', 'Urgent Review Required', 'Document Expired Alert'].map(o => `<option value="${settingsEscapeHtml(o)}" ${(String(r.template || 'Review Reminder') === o) ? 'selected' : ''}>${settingsEscapeHtml(o)}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <button type="button" class="btn btn-ghost" style="padding:6px 10px;" onclick="removeAutomationNotificationRule(${idx})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-ghost" style="margin-top: 10px;" onclick="addAutomationNotificationRule()">+ Add Notification Rule</button>
    </div>

    <div style="margin-bottom: 6px;">
      <h4 style="margin: 0 0 10px;">Auto-Escalation Rules</h4>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Overdue Days</th>
              <th>Escalate To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${escalationRules.map((r, idx) => `
              <tr>
                <td><input class="form-input" style="height: 34px;" type="number" min="0" value="${safeInt(r.overdue_days, 14)}" onchange="updateAutomationEscalationRule(${idx}, 'overdue_days', this.value)"></td>
                <td>
                  <select class="form-input" style="height: 34px;" onchange="updateAutomationEscalationRule(${idx}, 'escalate_to', this.value)">
                    ${['Quality Manager', 'Department Head'].map(o => `<option value="${settingsEscapeHtml(o)}" ${(String(r.escalate_to || 'Quality Manager') === o) ? 'selected' : ''}>${settingsEscapeHtml(o)}</option>`).join('')}
                  </select>
                </td>
                <td>
                  <button type="button" class="btn btn-ghost" style="padding:6px 10px;" onclick="removeAutomationEscalationRule(${idx})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <button type="button" class="btn btn-ghost" style="margin-top: 10px;" onclick="addAutomationEscalationRule()">+ Add Escalation Rule</button>
    </div>
  `;
}

function updateAutomationCategoryRule(idx, field, value) {
  const draft = getReviewAutomationDraft();
  const rules = draft.category_rules || [];
  const row = rules[idx] || {};
  const v = (value ?? '').toString();
  if (field === 'review_cycle_months' || field === 'warning_days') row[field] = parseInt(v, 10);
  else row[field] = v;
  rules[idx] = row;
  draft.category_rules = rules;
}

function addAutomationCategoryRule() {
  const draft = getReviewAutomationDraft();
  const rules = draft.category_rules || [];
  rules.push({ category: '', review_cycle_months: 12, warning_days: 30, auto_assign_to: 'Document Owner' });
  draft.category_rules = rules;
  renderAutomationEditor();
}

function removeAutomationCategoryRule(idx) {
  const draft = getReviewAutomationDraft();
  draft.category_rules = (draft.category_rules || []).filter((_, i) => i !== idx);
  renderAutomationEditor();
}

function updateAutomationNotificationRule(idx, field, value) {
  const draft = getReviewAutomationDraft();
  const rules = draft.notification_rules || [];
  const row = rules[idx] || {};
  row[field] = (value ?? '').toString();
  rules[idx] = row;
  draft.notification_rules = rules;
}

function toggleAutomationNotificationRecipient(idx, role, checked) {
  const draft = getReviewAutomationDraft();
  const rules = draft.notification_rules || [];
  const row = rules[idx] || {};
  const r = (role || '').toString();
  const current = Array.isArray(row.recipients) ? [...row.recipients] : [];
  const has = current.includes(r);
  if (checked && !has) current.push(r);
  if (!checked && has) row.recipients = current.filter(x => x !== r);
  else row.recipients = current;
  rules[idx] = row;
  draft.notification_rules = rules;
}

function updateAutomationNotificationRecipients(idx, selectEl) {
  const draft = getReviewAutomationDraft();
  const rules = draft.notification_rules || [];
  const row = rules[idx] || {};
  const recipients = Array.from(selectEl?.selectedOptions || []).map(o => o.value).filter(Boolean);
  row.recipients = recipients;
  rules[idx] = row;
  draft.notification_rules = rules;
}

function addAutomationNotificationRule() {
  const draft = getReviewAutomationDraft();
  const rules = draft.notification_rules || [];
  rules.push({ trigger: '30', recipients: ['Document Owner'], template: 'Review Reminder' });
  draft.notification_rules = rules;
  renderAutomationEditor();
}

function removeAutomationNotificationRule(idx) {
  const draft = getReviewAutomationDraft();
  draft.notification_rules = (draft.notification_rules || []).filter((_, i) => i !== idx);
  renderAutomationEditor();
}

function updateAutomationEscalationRule(idx, field, value) {
  const draft = getReviewAutomationDraft();
  const rules = draft.escalation_rules || [];
  const row = rules[idx] || {};
  if (field === 'overdue_days') row[field] = parseInt((value ?? '').toString(), 10);
  else row[field] = (value ?? '').toString();
  rules[idx] = row;
  draft.escalation_rules = rules;
}

function addAutomationEscalationRule() {
  const draft = getReviewAutomationDraft();
  const rules = draft.escalation_rules || [];
  rules.push({ overdue_days: 14, escalate_to: 'Quality Manager' });
  draft.escalation_rules = rules;
  renderAutomationEditor();
}

function removeAutomationEscalationRule(idx) {
  const draft = getReviewAutomationDraft();
  draft.escalation_rules = (draft.escalation_rules || []).filter((_, i) => i !== idx);
  renderAutomationEditor();
}

async function loadAutomationSettings() {
  const root = document.getElementById('review-automation-editor');
  if (!root) return;
  root.innerHTML = '<div style="text-align:center; padding:12px; color:var(--text-muted); border:1px solid var(--border); border-radius:10px;">Loading...</div>';
  try {
    const res = await fetch(`${settingsApiBaseUrl()}/settings/review-automation?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed');

    setReviewAutomationDraft({
      category_rules: Array.isArray(data?.category_rules) ? data.category_rules : [],
      notification_rules: Array.isArray(data?.notification_rules) ? data.notification_rules : [],
      escalation_rules: Array.isArray(data?.escalation_rules) ? data.escalation_rules : []
    });
    renderAutomationEditor();
  } catch {
    root.innerHTML = '<div style="text-align:center; padding:12px; color:var(--accent3); border:1px solid rgba(255,107,53,0.25); border-radius:10px;">Error loading automation settings.</div>';
  }
}

async function saveAutomationSettings() {
  const payload = getReviewAutomationDraft();

  const categoryRules = Array.isArray(payload.category_rules) ? payload.category_rules : [];
  const invalid = categoryRules.some(r => !(r?.category || '').trim());
  if (invalid) {
    settingsShowToast('Please fill Category for all category rules', 'error');
    return;
  }

  try {
    const res = await fetch(`${settingsApiBaseUrl()}/settings/review-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed');
    settingsShowToast('Automation settings saved', 'success');
  } catch {
    settingsShowToast('Error saving automation settings', 'error');
  }
}

