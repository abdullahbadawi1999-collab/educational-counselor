import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FiCheck, FiUser, FiAlertTriangle } from 'react-icons/fi'
import api from '../services/api'
import { useDebounce } from '../hooks/useApi'

const categoryLabels = {
  attendance: '📅 الحضور والغياب',
  conduct: '🚦 السلوك والانضباط',
  academic: '📖 الحفظ والمراجعة',
  other: '📋 أخرى'
}

const severityLabels = {
  high: { label: 'خطورة عالية', color: '#D32F2F', bg: '#FFEBEE' },
  medium: { label: 'متوسطة', color: '#F57C00', bg: '#FFF3E0' },
  low: { label: 'منخفضة', color: '#2E7D32', bg: '#E8F5E9' }
}

export default function BehaviorEntryPage({ showToast }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [behaviorTypes, setBehaviorTypes] = useState([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const debouncedSearch = useDebounce(search)

  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBehaviorType, setSelectedBehaviorType] = useState(null)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [lastAlert, setLastAlert] = useState(null)

  useEffect(() => {
    api.get('/behaviors/types').then(r => setBehaviorTypes(r.data))
  }, [])

  useEffect(() => {
    const studentId = searchParams.get('student')
    if (studentId) {
      api.get(`/students/${studentId}`).then(r => {
        setSelectedStudent(r.data)
        setSearch(r.data.name)
      })
    }
  }, [searchParams])

  useEffect(() => {
    if (debouncedSearch && !selectedStudent) {
      api.get(`/students?search=${debouncedSearch}&limit=10`).then(r => {
        setStudents(r.data.students)
        setShowDropdown(true)
      })
    } else {
      setStudents([])
      setShowDropdown(false)
    }
  }, [debouncedSearch])

  const selectStudent = (student) => {
    setSelectedStudent(student)
    setSearch(student.name)
    setShowDropdown(false)
  }

  const clearStudent = () => {
    setSelectedStudent(null)
    setSearch('')
  }

  const selectBehaviorType = (bt) => {
    if (selectedBehaviorType?.id === bt.id) {
      setSelectedBehaviorType(null)
      setDescription('')
    } else {
      setSelectedBehaviorType(bt)
      setDescription(bt.name)
    }
  }

  const handleSubmit = async () => {
    if (!selectedStudent || !description.trim() || !date) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/behaviors', {
        student_id: selectedStudent.id,
        behavior_type_id: selectedBehaviorType?.id || null,
        type: 'negative',
        description: description.trim(),
        date
      })

      if (res.data.generated_alert) {
        setLastAlert(res.data.generated_alert)
        showToast(`تم تسجيل المخالفة + ${res.data.generated_alert.level_name} تلقائي!`, 'success')
      } else {
        showToast('تم تسجيل المخالفة بنجاح')
        setLastAlert(null)
      }

      if (!searchParams.get('student')) {
        setSelectedStudent(null)
        setSearch('')
      }
      setSelectedCategory('')
      setSelectedBehaviorType(null)
      setDescription('')
      setDate(new Date().toISOString().split('T')[0])
    } catch {
      showToast('حدث خطأ أثناء التسجيل', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTypes = behaviorTypes.filter(bt => {
    if (selectedCategory && bt.category !== selectedCategory) return false
    return true
  })

  const categories = [...new Set(behaviorTypes.map(bt => bt.category))]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: 28 }}>تسجيل مخالفة جديدة</h1>

      {lastAlert && (
        <div style={{
          background: lastAlert.level === 3 ? '#FFEBEE' : lastAlert.level === 2 ? '#FFF3E0' : '#E3F2FD',
          border: `2px solid ${lastAlert.level === 3 ? '#D32F2F' : lastAlert.level === 2 ? '#F57C00' : '#1565C0'}`,
          borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <FiAlertTriangle size={24} color={lastAlert.level === 3 ? '#D32F2F' : lastAlert.level === 2 ? '#F57C00' : '#1565C0'} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              تم إنشاء {lastAlert.level_name} تلقائياً
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {lastAlert.reason} — يمكنك مراجعته في سجل المخالفات
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/records')} style={{ whiteSpace: 'nowrap', marginRight: 'auto' }}>
            عرض السجل
          </button>
        </div>
      )}

      <div className="card">
        <div className="form-group">
          <label><FiUser size={14} style={{ marginLeft: 4 }} />الطالب</label>
          <div className="student-selector">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-control"
                placeholder="ابحث عن اسم الطالب..."
                value={search}
                onChange={e => { setSearch(e.target.value); if (selectedStudent) clearStudent() }}
                onFocus={() => { if (students.length > 0) setShowDropdown(true) }}
              />
              {selectedStudent && (
                <button className="btn btn-outline btn-sm" onClick={clearStudent} style={{ whiteSpace: 'nowrap' }}>تغيير</button>
              )}
            </div>
            {selectedStudent && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, fontSize: 13 }}>
                <strong>{selectedStudent.name}</strong> — {selectedStudent.circle_name}
              </div>
            )}
            {showDropdown && students.length > 0 && (
              <div className="student-dropdown">
                {students.map(s => (
                  <div key={s.id} className="student-dropdown-item" onClick={() => selectStudent(s)}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="student-circle">{s.circle_name} — {s.teacher_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>تصنيف المخالفة (حسب الميثاق)</label>
          <div className="chip-group">
            <button
              className={`chip ${selectedCategory === '' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('')}
            >
              الكل
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(cat); setSelectedBehaviorType(null); setDescription('') }}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>اختر المخالفة</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredTypes.map(bt => (
              <button
                key={bt.id}
                onClick={() => selectBehaviorType(bt)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  border: selectedBehaviorType?.id === bt.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: selectedBehaviorType?.id === bt.id ? 'var(--primary-light)' : 'white',
                  cursor: 'pointer', textAlign: 'right', transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{bt.name}</div>
                  {bt.severity && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 10,
                      background: severityLabels[bt.severity]?.bg,
                      color: severityLabels[bt.severity]?.color
                    }}>
                      {severityLabels[bt.severity]?.label}
                    </span>
                  )}
                </div>
                {bt.escalation_rule && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left', maxWidth: 200 }}>
                    {bt.escalation_rule.immediate_warning ?
                      <span style={{ color: '#D32F2F', fontWeight: 600 }}>⚠ إنذار فوري</span> :
                      bt.escalation_rule.converts_to_absence_at ?
                        <span>كل {bt.escalation_rule.converts_to_absence_at} = غياب</span> :
                        bt.escalation_rule.alert_at ?
                          <span>تنبيه عند {bt.escalation_rule.alert_at} | إنذار عند {bt.escalation_rule.warning_at || '-'}</span> :
                          null
                    }
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>وصف المخالفة (تفاصيل إضافية)</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="اكتب تفاصيل إضافية عن المخالفة..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>التاريخ</label>
          <input type="date" className="form-control" value={date}
            onChange={e => setDate(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}
            style={{ padding: '12px 32px', fontSize: 16 }}>
            <FiCheck size={18} />
            {submitting ? 'جاري التسجيل...' : 'تسجيل المخالفة'}
          </button>
        </div>
      </div>
    </div>
  )
}
