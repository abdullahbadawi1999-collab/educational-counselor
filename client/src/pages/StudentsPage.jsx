import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiSearch, FiPhone, FiDownload } from 'react-icons/fi'
import { generateStudentPDF } from '../services/pdfExport'
import { FaWhatsapp } from 'react-icons/fa'
import api from '../services/api'
import { useDebounce } from '../hooks/useApi'

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [circles, setCircles] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [selectedCircle, setSelectedCircle] = useState(searchParams.get('circle') || '')
  const debouncedSearch = useDebounce(search)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/circles').then(r => setCircles(r.data))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCircle) params.set('circle_id', selectedCircle)
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('limit', '100')
    api.get(`/students?${params}`).then(r => {
      setStudents(r.data.students)
      setLoading(false)
    })
  }, [selectedCircle, debouncedSearch])

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
        <h1 className="page-title">الطلاب</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {loading ? '...' : `${students.length} طالب`}
          </span>
          <button className="btn btn-outline btn-sm" onClick={async () => {
            try {
              const scope = selectedCircle ? `circle&circle_id=${selectedCircle}` : 'all'
              const res = await api.get(`/reports/data?scope=${scope}`)
              generateStudentPDF(res.data)
            } catch { alert('حدث خطأ في التصدير') }
          }}>
            <FiDownload size={14} /> تصدير PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <FiSearch size={18} />
          <input
            className="form-control"
            placeholder="ابحث عن طالب..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: 38 }}
          />
        </div>
        <select
          className="form-control"
          style={{ width: 220 }}
          value={selectedCircle}
          onChange={e => setSelectedCircle(e.target.value)}
        >
          <option value="">جميع الحلقات</option>
          {circles.map(c => (
            <option key={c.id} value={c.id}>{c.name} - {c.teacher_name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>جاري التحميل...</div>
        ) : students.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الحلقة</th>
                  <th>المعلم</th>
                  <th>موبايل الطالب</th>
                  <th>موبايل ولي الأمر</th>
                  <th>موبايل ولي الأمر 2</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.circle_name}</td>
                    <td>{s.teacher_name}</td>
                    <td><PhoneLink phone={s.student_phone} /></td>
                    <td><PhoneLink phone={s.parent_phone_1} /></td>
                    <td><PhoneLink phone={s.parent_phone_2} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>لا توجد نتائج</h3>
            <p>حاول تغيير معايير البحث</p>
          </div>
        )}
      </div>
    </div>
  )
}
