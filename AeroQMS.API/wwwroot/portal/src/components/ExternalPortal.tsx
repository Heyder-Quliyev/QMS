import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getExternalPortal, submitFeedback } from '../services/portalApi';

export default function ExternalPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [portalData, setPortalData] = useState<any | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadExternalPortal(slug);
    }
  }, [slug]);

  const loadExternalPortal = async (slugVal: string) => {
    try {
      setLoading(true);
      const data = await getExternalPortal(slugVal);
      setPortalData(data);
      setError(null);
    } catch (err) {
      setError('Portal not found');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = (docId: number) => {
    console.log('Viewing document', docId);
  };

  const handleDownloadDocument = (docId: number) => {
    console.log('Downloading document', docId);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || !feedbackEmail.trim() || !slug) return;
    try {
      await submitFeedback(slug, { email: feedbackEmail, message: feedback });
      setFeedbackSubmitted(true);
      setFeedback('');
      setFeedbackEmail('');
    } catch (err) {
      setError('Failed to submit feedback');
    }
  };

  return (
    <div className="external-portal">
      <header className="external-header">
        <div className="external-logo">
          🏢
        </div>
        <h1 className="external-title">AeroQMS</h1>
        {portalData && <p className="external-subtitle">{portalData.groupName}</p>}
      </header>

      <div className="external-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="panel">
            <div className="panel-body" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', marginBottom: '8px' }}>Portal Not Found</h3>
              <p style={{ color: 'var(--text-muted)' }}>The portal you're looking for doesn't exist or may have been removed.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Shared Documents</h2>
              </div>
              <div className="panel-body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Doc #</th>
                      <th>Title</th>
                      <th>Revision</th>
                      <th>Effective Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portalData.documents.map((doc: any) => (
                      <tr key={doc.id}>
                        <td>{doc.docNumber}</td>
                        <td>{doc.title}</td>
                        <td>{doc.revision}</td>
                        <td>{new Date(doc.effectiveDate).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${doc.status === 'Approved' || doc.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn" onClick={() => handleViewDocument(doc.id)}>
                            View
                          </button>
                          <button className="btn btn-primary" onClick={() => handleDownloadDocument(doc.id)}>
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Submit Feedback</h2>
              </div>
              <div className="panel-body">
                {feedbackSubmitted ? (
                  <div className="success-message">
                    Thank you for your feedback! We appreciate you taking the time to reach out to us.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitFeedback}>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="your@email.com"
                        value={feedbackEmail}
                        onChange={e => setFeedbackEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Your Feedback</label>
                      <textarea
                        className="form-textarea"
                        placeholder="Please provide your feedback here..."
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Submit Feedback
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
