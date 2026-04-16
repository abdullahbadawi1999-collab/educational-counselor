import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { FiMenu } from 'react-icons/fi'
import Sidebar from './components/layout/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CirclesPage from './pages/CirclesPage'
import StudentsPage from './pages/StudentsPage'
import StudentDetailPage from './pages/StudentDetailPage'
import BehaviorEntryPage from './pages/BehaviorEntryPage'
import AlertsPage from './pages/AlertsPage'
import RecordsPage from './pages/RecordsPage'

function App() {
  const [toast, setToast] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('auth') === 'true'
  )

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile hamburger button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(true)}
        style={{
          position: 'fixed', top: 12, right: 12, zIndex: 90,
          background: 'var(--primary)', color: 'white', border: 'none',
          borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'none',
          alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600,
          fontFamily: 'inherit'
        }}
      >
        <FiMenu size={20} />
        <span>القائمة</span>
      </button>

      <main className="main-content" style={{
        flex: 1,
        marginRight: 'var(--sidebar-width)',
        padding: '24px 32px',
        minHeight: '100vh'
      }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/circles" element={<CirclesPage showToast={showToast} />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:id" element={<StudentDetailPage showToast={showToast} />} />
          <Route path="/behaviors/new" element={<BehaviorEntryPage showToast={showToast} />} />
          <Route path="/alerts" element={<RecordsPage showToast={showToast} />} />
          <Route path="/records" element={<RecordsPage showToast={showToast} />} />
        </Routes>
      </main>
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  )
}

export default App
