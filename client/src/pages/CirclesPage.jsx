import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBookOpen, FiUsers, FiUser } from 'react-icons/fi'
import api from '../services/api'

export default function CirclesPage({ showToast }) {
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/circles').then(r => {
      setCircles(r.data)
      setLoading(false)
    })
  }, [])

  const colors = [
    '#1B6B4A', '#1565C0', '#7B1FA2', '#C62828', '#EF6C00',
    '#00838F', '#4527A0', '#2E7D32', '#AD1457', '#283593',
    '#00695C', '#4E342E', '#37474F', '#827717', '#01579B', '#BF360C'
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>جاري التحميل...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">الحلقات</h1>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{circles.length} حلقة</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {circles.map((circle, idx) => (
          <div
            key={circle.id}
            className="card"
            style={{ cursor: 'pointer', transition: 'all 0.2s', borderTop: `4px solid ${colors[idx % colors.length]}` }}
            onClick={() => navigate(`/students?circle=${circle.id}`)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: colors[idx % colors.length] + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FiBookOpen size={22} color={colors[idx % colors.length]} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{circle.name}</h3>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
                <FiUser size={14} />
                <span>المعلم: {circle.teacher_name}</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--primary-light)', padding: '4px 10px',
                borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--primary)'
              }}>
                <FiUsers size={14} />
                {circle.student_count}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
