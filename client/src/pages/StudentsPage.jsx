import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiSearch, FiPhone, FiDownload, FiFileText } from 'react-icons/fi'
import { generateStudentExcel } from '../services/excelExport'
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
              generateStudentExcel(res.data)
            } catch { alert('حدث خطأ في التصدير') }
          }}>
            <FiDownload size={14} /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={async () => {
            try {
              const scope = selectedCircle ? `circle&circle_id=${selectedCircle}` : 'all'
              const res = await api.get(`/reports/data?scope=${scope}`)
              await generateStudentPDF(res.data)
            } catch (err) { console.error(err); alert('حدث خطأ في التصدير') }
          }}>
            <FiFileText size={14} /> PDF
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
                  <th>المخالفات المعلقة</th>
                  <th>موبايل الطالب</th>
                  <th>موبايل ولي الأمر</th>
                  <th>موبايل ولي الأمر 2</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.circle_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 1 }}>المعلم: {s.teacher_name}</div>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      {s.pending_violations ? (
                        <div style={{ fontSize: 12, color: '#D32F2F', fontWeight: 500, lineHeight: 1.6 }}>
                          {s.pending_violations}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>لا توجد مخالفات معلقة</span>
                      )}
                    </td>
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
