import { NavLink, useLocation } from 'react-router-dom'
import { FiHome, FiUsers, FiBookOpen, FiPlusCircle, FiAlertTriangle, FiX, FiLogOut } from 'react-icons/fi'

const navItems = [
  { path: '/', label: 'لوحة التحكم', icon: FiHome },
  { path: '/circles', label: 'الحلقات', icon: FiBookOpen },
  { path: '/students', label: 'الطلاب', icon: FiUsers },
  { path: '/behaviors/new', label: 'تسجيل مخالفة', icon: FiPlusCircle },
  { path: '/records', label: 'سجل المخالفات', icon: FiAlertTriangle },
]

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation()

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, display: 'none',
          }}
          className="sidebar-overlay"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{
        width: 'var(--sidebar-width)',
        background: 'linear-gradient(180deg, #1B6B4A 0%, #145236 100%)',
        color: 'white',
        position: 'fixed',
        right: 0, top: 0, bottom: 0,
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
        boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
        transition: 'transform 0.3s ease',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, letterSpacing: 1 }}>الماهر بالقرآن</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>الموجه التربوي</h1>
          </div>
          <button onClick={onClose} className="sidebar-close-btn" style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            borderRadius: 8, padding: 6, cursor: 'pointer', display: 'none'
          }}>
            <FiX size={20} />
          </button>
        </div>
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10, marginBottom: 4,
                color: 'white', fontSize: 15,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                transition: 'all 0.2s ease'
              })}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={() => {
            localStorage.removeItem('auth')
            window.location.reload()
          }} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 16px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.1)', color: 'white',
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit'
          }}>
            <FiLogOut size={18} />
            تسجيل خروج
          </button>
        </div>
      </aside>
    </>
  )
}
