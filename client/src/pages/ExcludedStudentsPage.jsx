import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiUserX, FiRotateCcw, FiPhone } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import api from '../services/api'

export default function ExcludedStudentsPage({ showToast }) {
  const [students, setStudents] = useState([])
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(null) // student id whose circle-picker is open
  const [chosenCircle, setChosenCircle] = useState('')
  const navigate = useNavigate()

  const fetchData = () => {
    setLoading(true)
    api.get('/students?active=0&limit=500').then(r => {
      setStudents(r.data.students)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    api.get('/circles').then(r => setCircles(r.data)).catch(() => {})
    fetchData()
  }, [])

  const openRestore = (s) => {
    setRestoring(s.id)
    setChosenCircle(String(s.circle_id || ''))
  }

  const confirmRestore = async (s) => {
    if (!chosenCircle) { showToast && showToast('اختر الحلقة أولاً', 'error'); return }
    try {
      await api.post(`/students/${s.id}/restore`, { circle_id: parseInt(chosenCircle) })
      showToast && showToast('تم إرجاع الطالب للحلقة')
      setRestoring(null)
      fetchData()
    } catch { showToast && showToast('حدث خطأ', 'error') }
  }

  const PhoneLink = ({ phone }) => {
    if (!phone) return <span style={{ color: 'var(--text-light)' }}>-</span>
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a href={`tel:${phone}`} className="phone-link" onClick={e => e.stopPropagation()}>
          <FiPhone size={13} />{phone}
        </a>
        <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="phone-link wa-link" onClick={e => e.stopPropagation()}>
          <FaWhatsapp size={16} />
        </a>
      </span>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">الطلاب المستبعدون</h1>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {loading ? '...' : `${students.length} طالب`}
        </span>
      </div>

      <div style={{
        background: 'var(--warning-light)', border: '1px solid #FFE082',
        borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
        fontSize: 13, color: '#8a5a00'
      }}>
        هؤلاء الطلاب مستبعدون من الحلقات. سجلاتهم القديمة محفوظة وتظهر في تقارير الفصول السابقة.
        يمكنك إرجاع أي طالب إلى الحلقة التي تحددها.
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>جاري التحميل...</div>
        ) : students.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>آخر حلقة</th>
                  <th>موبايل ولي الأمر</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} style={{ cursor: 'default' }}>
                    <td onClick={() => navigate(`/students/${s.id}`)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                      {s.code && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>كود: {s.code}</div>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.circle_name || '— (بدون حلقة)'}</td>
                    <td><PhoneLink phone={s.parent_phone_1} /></td>
                    <td style={{ minWidth: 260 }}>
                      {restoring === s.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <select
                            className="form-control"
                            style={{ width: 170, padding: '6px 10px', fontSize: 13 }}
                            value={chosenCircle}
                            onChange={e => setChosenCircle(e.target.value)}
                          >
                            <option value="">اختر الحلقة...</option>
                            {circles.map(c => (
                              <option key={c.id} value={c.id}>{c.name} - {c.teacher_name}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary btn-sm" onClick={() => confirmRestore(s)}>تأكيد</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setRestoring(null)}>إلغاء</button>
                        </div>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => openRestore(s)}>
                          <FiRotateCcw size={14} /> إرجاع للحلقة
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FiUserX />
            <h3>لا يوجد طلاب مستبعدون</h3>
            <p>كل الطلاب ضمن الحلقات النشطة</p>
          </div>
        )}
      </div>
    </div>
  )
}
