import { NavLink } from 'react-router-dom'
import { FiHome, FiUsers, FiBookOpen, FiPlusCircle, FiAlertTriangle } from 'react-icons/fi'

const navItems = [
  { path: '/', label: 'لوحة التحكم', icon: FiHome },
  { path: '/circles', label: 'الحلقات', icon: FiBookOpen },
  { path: '/students', label: 'الطلاب', icon: FiUsers },
  { path: '/behaviors/new', label: 'تسجيل سلوك', icon: FiPlusCircle },
  { path: '/alerts', label: 'التنبيهات والإنذارات', icon: FiAlertTriangle },
]

export default function Sidebar() {
  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'linear-gradient(180deg, #1B6B4A 0%, #145236 100%)',
      color: 'white',
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      boxShadow: '-4px 0 15px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        padding: '28px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.15)'
      }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, letterSpacing: 1 }}>الماهر بالقرآن</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>الموجه التربوي</h1>
      </div>
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 10,
              marginBottom: 4,
              color: 'white',
              fontSize: 15,
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
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        fontSize: 12,
        opacity: 0.5,
        textAlign: 'center'
      }}>
        v1.0 - الموجه التربوي
      </div>
    </aside>
  )
}
