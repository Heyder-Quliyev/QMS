import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getPortalGroups,
  createPortalGroup,
  getGroupDocuments,
  getAllDocuments,
  addDocumentToGroup,
  removeDocumentFromGroup,
  getGroupUsers,
  inviteUser,
  revokeUser,
  regenerateToken,
  getGroupLogs,
  getGroupFeedback
} from '../services/portalApi';

export default function AdminPortal() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSlug, setNewGroupSlug] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [copiedUserId, setCopiedUserId] = useState<number | null>(null);
  const [lastInvite, setLastInvite] = useState<any>(null);

  useEffect(() => {
    loadGroups();
    loadAllDocs();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id);
    }
  }, [selectedGroup]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await getPortalGroups();
      setGroups(data);
      if (data.length > 0 && !selectedGroup) setSelectedGroup(data[0]);
      setError(null);
    } catch (err) {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadAllDocs = async () => {
    try {
      const data = await getAllDocuments();
      setAllDocs(data);
    } catch (err) {
      console.error('Failed to load all docs');
    }
  };

  const loadGroupData = async (groupId: number) => {
    try {
      const [docsData, usersData, logsData, feedbackData] = await Promise.all([
        getGroupDocuments(groupId),
        getGroupUsers(groupId),
        getGroupLogs(groupId),
        getGroupFeedback(groupId)
      ]);
      setDocuments([...docsData]);
      setUsers([...usersData]);
      setLogs([...logsData]);
      setFeedbacks([...feedbackData]);
    } catch (err) {
      console.error('Failed to load group data:', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPortalGroup({ name: newGroupName, slug: newGroupSlug });
      setNewGroupName('');
      setNewGroupSlug('');
      loadGroups();
    } catch (err) {
      setError('Failed to create group');
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !selectedGroup) return;
    try {
      await addDocumentToGroup(selectedGroup.id, parseInt(selectedDocId));
      setSelectedDocId('');
      await loadGroupData(selectedGroup.id);
    } catch (err) {
      console.error("Error adding document:", err);
      setError('Failed to add document');
    }
  };

  const handleRemoveDocument = async (portalDocumentId: number) => {
    if (!selectedGroup) return;
    try {
      await removeDocumentFromGroup(selectedGroup.id, portalDocumentId);
      await loadGroupData(selectedGroup.id);
    } catch (err) {
      console.error('Error in handleRemoveDocument:', err);
      setError('Failed to remove document: ' + (err as Error).message);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      const result = await inviteUser(selectedGroup.id, newUserEmail, newUserName);
      setLastInvite(result);
      setNewUserEmail('');
      setNewUserName('');
      await loadGroupData(selectedGroup.id);
      if (result.emailSent) {
        setSuccessMessage(`Invitation email sent to ${result.email}!`);
      } else {
        setSuccessMessage(`User ${result.name} created successfully! Please copy the link manually.`);
      }
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError('Failed to invite user');
    }
  };

  const handleRegenerateToken = async (userId: number, sendEmail = false) => {
    if (!selectedGroup) return;
    try {
      const result = await regenerateToken(selectedGroup.id, userId, sendEmail);
      setLastInvite(result);
      await loadGroupData(selectedGroup.id);
      if (sendEmail && result.emailSent) {
        setSuccessMessage(`New token generated and email sent to ${result.email}!`);
      } else if (sendEmail && !result.emailSent) {
        setSuccessMessage(`New token generated! Please copy the link manually.`);
      } else {
        setSuccessMessage(`New token generated successfully!`);
      }
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError('Failed to regenerate token');
    }
  };

  const handleCopyLink = async (user: any) => {
    const url = `${window.location.origin}/portal/${user.accessToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedUserId(user.id);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  const handleRevokeUser = async (userId: number) => {
    if (!window.confirm("Revoke access for this user?")) return;
    try {
      await revokeUser(userId);
      await loadGroupData(selectedGroup!.id);
    } catch (err) {
      console.error('Error revoking user:', err);
      setError('Failed to revoke user');
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="2.5">
              <path d="M22 12L2 12M22 12L13 21M22 12L13 3" />
            </svg>
          </div>
          <div className="logo-text">AeroQMS</div>
        </div>
        <nav className="nav-list">
          <Link to="/" className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            Portal Admin
          </div>
        </nav>
      </aside>
      <main className="main-content">
        <header className="header">
          <h1 className="page-title">Portal Admin</h1>
        </header>
        <div className="content-body">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              {error && <div className="error">{error}</div>}
              {successMessage && <div className="success-message">{successMessage}</div>}
              
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Portal Groups</h2>
                </div>
                <div className="panel-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Slug</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(group => (
                        <tr key={group.id}>
                          <td>{group.name}</td>
                          <td>{group.slug}</td>
                          <td>
                            <button
                              className="btn"
                              onClick={() => setSelectedGroup(group)}
                              style={{
                                backgroundColor: selectedGroup?.id === group.id ? 'rgba(59, 139, 255, 0.1)' : 'transparent',
                                border: selectedGroup?.id === group.id ? '1px solid rgba(59, 139, 255, 0.3)' : '1px solid var(--border)',
                                color: selectedGroup?.id === group.id ? 'var(--accent2)' : 'var(--text)'
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <form onSubmit={handleCreateGroup} style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="form-label">Group Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Supplier Portal"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="form-label">Slug</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. supplier-portal"
                        value={newGroupSlug}
                        onChange={e => setNewGroupSlug(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Create Group
                    </button>
                  </form>
                </div>
              </div>

              {selectedGroup && (
                <>
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title">Documents in {selectedGroup.name}</h2>
                    </div>
                    <div className="panel-body">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Doc #</th>
                            <th>Title</th>
                            <th>Revision</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map(pd => (
                            <tr key={pd.id}>
                              <td>{pd.docNumber}</td>
                              <td>{pd.title}</td>
                              <td>{pd.revision}</td>
                              <td>
                                <span className={`badge ${pd.status === 'Approved' ? 'badge-green' : pd.status === 'Under Review' ? 'badge-yellow' : 'badge-gray'}`}>
                                  {pd.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-danger"
                                  onClick={() => handleRemoveDocument(pd.id)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <form onSubmit={handleAddDocument} style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <label className="form-label">Add Document</label>
                          <select
                            className="form-select"
                            value={selectedDocId}
                            onChange={e => setSelectedDocId(e.target.value)}
                            required
                          >
                            <option value="">Select Document</option>
                            {allDocs.filter(d => !documents.find(pd => pd.documentId === d.id)).map(doc => (
                              <option key={doc.id} value={doc.id}>{doc.documentNumber} - {doc.title}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className="btn btn-primary">
                          Add Document
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title">External Users for {selectedGroup.name}</h2>
                    </div>
                    <div className="panel-body">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Access Link</th>
                            <th>Last Access</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(user => (
                            <tr key={user.id}>
                              <td>{user.name}</td>
                              <td>{user.email}</td>
                              <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Link to={`/portal/${user.accessToken}`} style={{ color: 'var(--accent2)', textDecoration: 'none' }}>
                                  /portal/{user.accessToken.substring(0, 12)}...
                                </Link>
                                <button 
                                  className="btn" 
                                  onClick={() => handleCopyLink(user)}
                                  style={{ fontSize: '12px', padding: '4px 8px' }}
                                >
                                  {copiedUserId === user.id ? 'Copied!' : 'Copy Link'}
                                </button>
                              </td>
                              <td>{user.lastAccess ? new Date(user.lastAccess).toLocaleString() : 'Never'}</td>
                              <td style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn" onClick={() => {
                                  if (window.confirm("Regenerate token? This will invalidate the old link. Also send email?")) {
                                    handleRegenerateToken(user.id, true);
                                  }
                                }}>
                                  Regenerate Token
                                </button>
                                <button className="btn btn-danger" onClick={() => handleRevokeUser(user.id)}>
                                  Revoke
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {lastInvite && (
                        <div className="panel" style={{ marginTop: '16px', border: '1px dashed var(--border)' }}>
                          <div className="panel-body">
                            <strong>Invite Details:</strong><br />
                            {!lastInvite.emailSent && (
                              <>
                                User created but email failed to send. Copy the link below and send manually:
                                {lastInvite.emailError && (
                                  <div style={{ 
                                    background: '#fff3cd', 
                                    color: '#856404', 
                                    padding: '8px 12px', 
                                    borderRadius: '6px', 
                                    marginTop: '8px',
                                    marginBottom: '8px',
                                    fontSize: '14px'
                                  }}>
                                    <strong>Error:</strong> {lastInvite.emailError}
                                  </div>
                                )}
                                <div style={{ 
                                  background: '#f0f2f5', 
                                  padding: '8px 12px', 
                                  borderRadius: '6px', 
                                  marginTop: '8px',
                                  fontFamily: 'monospace',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <span>{`${window.location.origin}/portal/${lastInvite.accessToken}`}</span>
                                  <button 
                                    className="btn" 
                                    onClick={() => handleCopyLink(lastInvite)}
                                    style={{ fontSize: '12px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                                  >
                                    Copy
                                  </button>
                                </div>
                              </>
                            )}
                            {lastInvite.emailSent && !lastInvite.emailError && (
                              <div style={{ color: 'var(--success)', marginTop: '8px' }}>
                                ✓ Invitation email sent successfully!
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleInviteUser} style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <label className="form-label">Name</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. John Doe"
                            value={newUserName}
                            onChange={e => setNewUserName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-input"
                            placeholder="e.g. john@supplier.com"
                            value={newUserEmail}
                            onChange={e => setNewUserEmail(e.target.value)}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary">
                          Invite User
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title">Access Logs</h2>
                    </div>
                    <div className="panel-body">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Document</th>
                            <th>Action</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map(log => (
                            <tr key={log.id}>
                              <td>{log.userName || 'Anonymous'}</td>
                              <td>{log.docNumber} - {log.docTitle}</td>
                              <td>
                                <span className={`badge ${log.action === 'download' ? 'badge-blue' : 'badge-gray'}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td>{new Date(log.accessedAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title">Document Feedback</h2>
                    </div>
                    <div className="panel-body">
                      {feedbacks.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No feedback received yet.
                        </div>
                      ) : (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Email</th>
                              <th>Document</th>
                              <th>Message</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feedbacks.map(feedback => (
                              <tr key={feedback.id}>
                                <td>{feedback.email}</td>
                                <td>
                                  {feedback.documentNumber && feedback.documentTitle ? 
                                    `${feedback.documentNumber} - ${feedback.documentTitle}` : 
                                    '(General feedback)'}
                                </td>
                                <td title={feedback.message}>
                                  {feedback.message.length > 100 
                                    ? `${feedback.message.substring(0, 100)}...` 
                                    : feedback.message}
                                </td>
                                <td>{new Date(feedback.createdAt).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
