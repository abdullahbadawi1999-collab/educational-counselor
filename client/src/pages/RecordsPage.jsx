import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiAlertTriangle, FiTrash2, FiFilter } from 'react-icons/fi'
import api from '../services/api'

const levelConfig = {
  1: { name: 'تنبيه', color: '#1565C0', bg: '#E3F2FD', border: '#BBDEFB', icon: '📞' },
  2: { name: 'إنذار', color: '#F57C00', bg: '#FFF3E0', border: '#FFE0B2', icon: '⚠️' },
  3: { name: 'قرار', color: '#D32F2F', bg: '#FFEBEE', border: '#FFCDD2', icon: '🚦' }
}

export default function RecordsPage({ showToast }) {
  const [alerts, setAlerts] = useState([])
  const [behaviors, setBehaviors] = useState([])
  const [circles, setCircles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterKind, setFilterKind] = useState('all') // all | behaviors | alerts
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCircle, setFilterCircle] = useState('')
  const [sortBy, setSortBy] = useState('date_desc') // date_desc | date_asc | name | type | circle
  const [actionModal, setActionModal] = useState(null)
  const [actionText, setActionText] = useState('')
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0])
  const navigate = useNavigate()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [alertsRes, behaviorsRes, circlesRes] = await Promise.all([
        api.get('/alerts?limit=1000'),
        api.get('/behaviors?limit=1000'),
        api.get('/circles')
      ])
      setAlerts(alertsRes.data.alerts || [])
      setBehaviors(behaviorsRes.data || [])
      setCircles(circlesRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Build unified list
  const unified = useMemo(() => {
    const items = []

    // Behaviors as records
    for (const b of behaviors) {
      items.push({
        kind: 'behavior',
        id: `b-${b.id}`,
        raw_id: b.id,
        student_id: b.student_id,
        student_name: b.student_name,
        circle_name: b.circle_name,
        circle_id: b.circle_id,
        type: b.type, // positive/negative
        category: b.behavior_type_name,
        description: b.description,
        date: b.date,
        action_count: b.action_count,
        created_at: b.created_at
      })
    }

    // Alerts as records
    for (const a of alerts) {
      items.push({
        kind: 'alert',
        id: `a-${a.id}`,
        raw_id: a.id,
        student_id: a.student_id,
        student_name: a.student_name,
        circle_name: a.circle_name,
        level: a.level,
        level_name: a.level_name,
        description: a.reason,
        status: a.status,
        action_taken: a.action_taken,
        action_date: a.action_date,
        trigger_type: a.trigger_type,
        date: a.created_at?.split('T')[0] || a.created_at,
        created_at: a.created_at
      })
    }

    return items
  }, [alerts, behaviors])

  // Apply filters
  const filtered = useMemo(() => {
    let list = unified
    if (filterKind === 'behaviors') list = list.filter(x => x.kind === 'behavior')
    if (filterKind === 'alerts') list = list.filter(x => x.kind === 'alert')
    if (filterLevel) list = list.filter(x => x.kind === 'alert' && String(x.level) === filterLevel)
    if (filterStatus) list = list.filter(x => x.kind === 'alert' && x.status === filterStatus)
    if (filterCircle) list = list.filter(x => String(x.circle_id) === filterCircle || x.circle_name === circles.find(c => String(c.id) === filterCircle)?.name)

    // Sorting
    const copy = [...list]
    if (sortBy === 'date_desc') copy.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    else if (sortBy === 'date_asc') copy.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    else if (sortBy === 'name') copy.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'ar'))
    else if (sortBy === 'circle') copy.sort((a, b) => (a.circle_name || '').localeCompare(b.circle_name || '', 'ar'))
    else if (sortBy === 'type') copy.sort((a, b) => {
      const order = (x) => x.kind === 'alert' ? (3 + (x.level || 0)) : (x.type === 'negative' ? 2 : 1)
      return order(b) - order(a)
    })
    return copy
  }, [unified, filterKind, filterLevel, filterStatus, filterCircle, sortBy, circles])

  const pendingCount = alerts.filter(a => a.status === 'pending').length
  const alertLevelCount = (lv) => alerts.filter(a => a.level === lv).length

  const handleQuickAction = async (alertId, text) => {
    try {
      await api.put(`/alerts/${alertId}`, {
        status: 'done', action_taken: text,
        action_date: new Date().toISOString().split('T')[0]
      })
      showToast && showToast('تم تسجيل الإجراء')
      fetchAll()
    } catch { showToast && showToast('حدث خطأ', 'error') }
  }

  const handleCustomAction = async (alertId) => {
    if (!actionText.trim()) return
    try {
      await api.put(`/alerts/${alertId}`, {
        status: 'done', action_taken: actionText.trim(), action_date: actionDate
      })
      showToast && showToast('تم تسجيل الإجراء')
      setActionModal(null); setActionText('')
      fetchAll()
    } catch { showToast && showToast('حدث خطأ', 'error') }
  }

  const handleDeleteAlert = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا التنبيه/الإنذار؟')) return
    try { await api.delete(`/alerts/${id}`); showToast && showToast('تم الحذف'); fetchAll() }
    catch { showToast && showToast('حدث خطأ', 'error') }
  }

  const handleDeleteBehavior = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه المخالفة؟ سيتم حذف جميع التنبيهات المرتبطة بها.')) return
    try { await api.delete(`/behaviors/${id}`); showToast && showToast('تم الحذف'); fetchAll() }
    catch { showToast && showToast('حدث خطأ', 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">سجل المخالفات</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            كل المخالفات والتنبيهات والإنذارات والقرارات حسب ميثاق الالتزام والانضباط
          </p>
        </div>
        {pendingCount > 0 && (
          <div style={{
            background: '#FFEBEE', color: '#D32F2F', padding: '8px 16px',
            borderRadius: 20, fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FiAlertTriangle size={16} />
            {pendingCount} بانتظار الإجراء
          </div>
        )}
      </div>

      {/* Summary cards for alert levels */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[1, 2, 3].map(level => {
          const cfg = levelConfig[level]
          const count = alertLevelCount(level)
          const pending = alerts.filter(a => a.level === level && a.status === 'pending').length
          return (
            <div key={level} style={{
              background: cfg.bg, borderRadius: 12, padding: 14,
              border: `1px solid ${cfg.border}`, cursor: 'pointer'
            }} onClick={() => { setFilterKind('alerts'); setFilterLevel(filterLevel == level ? '' : String(level)) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: cfg.color }}>{cfg.name}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: cfg.color }}>{count}</div>
              {pending > 0 && (
                <div style={{ fontSize: 12, color: cfg.color, fontWeight: 600, marginTop: 2 }}>
                  {pending} بانتظار الإجراء
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Filters bar */}
      <div className="filters-bar">
        <select className="form-control" value={filterKind} onChange={e => setFilterKind(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}>
          <option value="all">الكل (مخالفات وتنبيهات)</option>
          <option value="behaviors">المخالفات فقط</option>
          <option value="alerts">التنبيهات فقط</option>
        </select>
        <select className="form-control" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}>
          <option value="">جميع المستويات</option>
          <option value="1">تنبيه</option>
          <option value="2">إنذار</option>
          <option value="3">قرار</option>
        </select>
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}>
          <option value="">جميع الحالات</option>
          <option value="pending">بانتظار الإجراء</option>
          <option value="done">تم الإجراء</option>
        </select>
        <select className="form-control" value={filterCircle} onChange={e => setFilterCircle(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}>
          <option value="">جميع الحلقات</option>
          {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-control" value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ width: 'auto', minWidth: 160 }}>
          <option value="date_desc">الأحدث أولاً</option>
          <option value="date_asc">الأقدم أولاً</option>
          <option value="name">الاسم (أبجدي)</option>
          <option value="circle">حسب الحلقة</option>
          <option value="type">حسب النوع / المستوى</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>جاري التحميل...</div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            if (item.kind === 'alert') {
              const cfg = levelConfig[item.level]
              return (
                <div key={item.id} style={{
                  background: 'white', borderRadius: 12, overflow: 'hidden',
                  border: `1px solid ${cfg.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  borderRight: `5px solid ${cfg.color}`
                }}>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {cfg.icon} {item.level_name}
                        </span>
                        <span style={{
                          background: item.status === 'pending' ? '#FFF3E0' : '#E8F5E9',
                          color: item.status === 'pending' ? '#F57C00' : '#2E7D32',
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
                        }}>
                          {item.status === 'pending' ? '⏳ بانتظار' : '✅ تم الإجراء'}
                        </span>
                        {item.trigger_type === 'auto' && (
                          <span style={{ fontSize: 10, color: 'var(--text-light)', background: 'var(--border-light)', padding: '2px 8px', borderRadius: 10 }}>
                            تلقائي
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{item.date}</span>
                        <button onClick={() => handleDeleteAlert(item.raw_id)}
                          style={{ background: 'none', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 4 }}>
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div onClick={() => navigate(`/students/${item.student_id}`)} style={{ cursor: 'pointer', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{item.student_name}</span>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{item.circle_name}</div>
                    </div>

                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {item.description}
                    </div>

                    {item.status === 'done' && item.action_taken && (
                      <div style={{ background: '#E8F5E9', borderRadius: 8, padding: '8px 12px', marginTop: 6, borderRight: '3px solid #2E7D32' }}>
                        <div style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600, marginBottom: 1 }}>✅ الإجراء المتخذ:</div>
                        <div style={{ fontSize: 13 }}>{item.action_taken}</div>
                        {item.action_date && <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{item.action_date}</div>}
                      </div>
                    )}

                    {item.status === 'pending' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" onClick={() => handleQuickAction(item.raw_id, 'تم التواصل مع ولي الأمر')}
                          style={{ background: '#E3F2FD', color: '#1565C0', fontSize: 12 }}>
                          📞 تم التواصل مع ولي الأمر
                        </button>
                        <button className="btn btn-sm" onClick={() => handleQuickAction(item.raw_id, 'تم تنبيه الطالب')}
                          style={{ background: '#FFF3E0', color: '#E65100', fontSize: 12 }}>
                          ⚠️ تم تنبيه الطالب
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => { setActionModal(item.raw_id); setActionText('') }}>
                          <FiCheck size={13} /> إجراء آخر
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            } else {
              // Behavior item
              const isNeg = item.type === 'negative'
              return (
                <div key={item.id} style={{
                  background: 'white', borderRadius: 12, overflow: 'hidden',
                  border: `1px solid ${isNeg ? '#FFCDD2' : '#C8E6C9'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  borderRight: `5px solid ${isNeg ? '#D32F2F' : '#2E7D32'}`
                }}>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={`badge badge-${item.type}`}>
                          {isNeg ? '❌ مخالفة' : '✅ إيجابي'}
                        </span>
                        {item.category && (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '3px 8px', borderRadius: 10 }}>
                            {item.category}
                          </span>
                        )}
                        <span style={{
                          background: item.action_count > 0 ? '#E8F5E9' : '#FFF3E0',
                          color: item.action_count > 0 ? '#2E7D32' : '#F57C00',
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
                        }}>
                          {item.action_count > 0 ? `✅ تم (${item.action_count})` : '⏳ بانتظار'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{item.date}</span>
                        <button onClick={() => handleDeleteBehavior(item.raw_id)}
                          style={{ background: 'none', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 4 }}>
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div onClick={() => navigate(`/students/${item.student_id}`)} style={{ cursor: 'pointer', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{item.student_name}</span>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{item.circle_name}</div>
                    </div>

                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              )
            }
          })}
        </div>
      ) : (
        <div className="card empty-state">
          <h3>لا توجد سجلات مطابقة</h3>
          <p>حاول تغيير معايير التصفية</p>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تسجيل إجراء</h2>
              <button className="modal-close" onClick={() => setActionModal(null)}>&times;</button>
            </div>
            <div className="form-group">
              <label>إجراء سريع</label>
              <div className="chip-group">
                {['تم التواصل مع ولي الأمر', 'تم تنبيه الطالب'].map(qa => (
                  <button key={qa} className={`chip ${actionText === qa ? 'active' : ''}`}
                    onClick={() => setActionText(qa)}>{qa}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>أو اكتب إجراء آخر</label>
              <textarea className="form-control" rows={3}
                placeholder="مثال: تم الاتصال بولي الأمر..."
                value={actionText} onChange={e => setActionText(e.target.value)} />
            </div>
            <div className="form-group">
              <label>تاريخ الإجراء</label>
              <input type="date" className="form-control" value={actionDate} onChange={e => setActionDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => handleCustomAction(actionModal)}>
                <FiCheck size={16} /> حفظ
              </button>
              <button className="btn btn-outline" onClick={() => setActionModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
