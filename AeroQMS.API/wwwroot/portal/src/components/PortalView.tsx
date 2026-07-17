import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPortalByToken,
  viewDocument,
  downloadDocument,
  submitFeedback
} from '../services/portalApi';

export default function PortalView() {
  const { slug: token } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<any>(null);
  const [selectedDocId, setSelectedDocId] = useState<number | ''>('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    loadPortal();
  }, [token]);

  const loadPortal = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getPortalByToken(token);
      setPortalData(data);
      setError(null);
    } catch (err: any) {
      console.error('Error loading portal:', err);
      setError('This portal link is not valid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (docId: number) => {
    if (!token) return;
    try {
      const response = await viewDocument(token, docId);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error viewing document:', err);
    }
  };

  const handleDownloadDocument = async (docId: number) => {
    if (!token) return;
    try {
      const response = await downloadDocument(token, docId);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Try to get filename from Content-Disposition, otherwise use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `document-${docId}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await submitFeedback(token, {
        documentId: selectedDocId ? Number(selectedDocId) : undefined,
        email: feedbackEmail,
        message: feedbackMessage
      });
      setFeedbackMessage('');
      setFeedbackEmail('');
      setSelectedDocId('');
      setFeedbackSuccess(true);
      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'badge-green';
      case 'Under Review':
        return 'badge-yellow';
      default:
        return 'badge-gray';
    }
  };

  if (loading) {
    return (
      <div className="portal-view">
        <div className="loading">Loading Portal...</div>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="portal-view">
        <div className="error-panel">{error}</div>
      </div>
    );
  }

  return (
    <div className="portal-view">
      <header className="portal-header">
        <div className="logo-container">
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="2.5">
              <path d="M22 12L2 12M22 12L13 21M22 12L13 3" />
            </svg>
          </div>
          <div className="logo-text">AeroQMS</div>
        </div>
        <h1 className="portal-title">{portalData.groupName}</h1>
        <p className="portal-subtitle">Documents shared by {portalData.companyName}</p>
      </header>

      <main className="portal-content">
        <div className="document-grid">
          {portalData.documents.map((doc: any) => (
            <div key={doc.id} className="document-card">
              <div className="doc-info">
                <div className="doc-number">{doc.docNumber}</div>
                <h3 className="doc-title">{doc.title}</h3>
                <div className="doc-meta">
                  <span>Revision: {doc.revision}</span>
                  <span>Effective: {doc.effectiveDate}</span>
                </div>
                <span className={`badge ${getStatusBadgeClass(doc.status)}`}>
                  {doc.status}
                </span>
              </div>
              <div className="doc-actions">
                <button
                  className="btn"
                  onClick={() => handleViewDocument(doc.id)}
                >
                  View
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownloadDocument(doc.id)}
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="feedback-section">
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Document Feedback</h2>
            </div>
            <div className="panel-body">
              {feedbackSuccess && (
                <div className="success-message">
                  Thank you for your feedback!
                </div>
              )}
              {error && <div className="error">{error}</div>}
              <form onSubmit={handleSubmitFeedback}>
                <div className="form-group">
                  <label className="form-label">Your Email (optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Document (optional)</label>
                  <select
                    className="form-select"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Select a document</option>
                    {portalData.documents.map((doc: any) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.docNumber} - {doc.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Feedback</label>
                  <textarea
                    className="form-input"
                    placeholder="Describe your feedback or question..."
                    rows={4}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Submit Feedback
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
