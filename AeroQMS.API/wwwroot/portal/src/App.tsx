import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminPortal from './components/AdminPortal'
import PortalView from './components/PortalView'
import './index.css'

function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/:slug" element={<PortalView />} />
        <Route path="/" element={
          <div className="app-container" style={{
            display: 'flex',
            minHeight: '100vh',
            backgroundColor: 'var(--navy-dark)',
            color: 'var(--text)'
          }}>
            <main className="main-content" style={{
              marginLeft: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontFamily: 'Syne, sans-serif', marginBottom: '20px' }}>
                  AeroQMS Portal
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                  Please use the Admin link from the main AeroQMS application to access the portal.
                </p>
              </div>
            </main>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
