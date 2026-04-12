import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import CirclesPage from './pages/CirclesPage'
import StudentsPage from './pages/StudentsPage'
import StudentDetailPage from './pages/StudentDetailPage'
import BehaviorEntryPage from './pages/BehaviorEntryPage'
import AlertsPage from './pages/AlertsPage'

function App() {
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
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
          <Route path="/alerts" element={<AlertsPage showToast={showToast} />} />
        </Routes>
      </main>
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  )
}

export default App
