import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiFilter, FiAlertTriangle, FiAlertCircle, FiXCircle, FiTrash2 } from 'react-icons/fi'
import api from '../services/api'

const levelConfig = {
  1: { name: 'تنبيه', color: '#1565C0', bg: '#E3F2FD', border: '#BBDEFB', icon: '📞' },
  2: { name: 'إنذار', color: '#F57C00', bg: '#FFF3E0', border: '#FFE0B2', icon: '⚠️' },
  3: { name: 'قرار', color: '#D32F2F', bg: '#FFEBEE', border: '#FFCDD2', icon: '🚦' }
}

export default function AlertsPage({ showToast }) {
  const [alerts, setAlerts] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState(null)
  const [actionText, setActionText] = useState('')
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0])
  const navigate = useNavigate()

  const fetchAlerts = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterLevel) params.set('level', filterLevel)
    if (filterStatus) params.set('status', filterStatus)
    const res = await api.get(`/alerts?${params}`)
    setAlerts(res.data.alerts)
    setPendingCount(res.data.pending_count)
    setLoading(false)
  }

  useEffect(() => { fetchAlerts() }, [filterLevel, filterStatus])

  const handleMarkDone = async (alertId) => {
    if (!actionText.trim()) {
      showToast('يرجى كتابة الإجراء المتخذ', 'error')
      return
    }
    await api.put(`/alerts/${alertId}`, {
      status: 'done',
      action_taken: actionText.trim(),
      action_date: actionDate
    })
    showToast('تم تسجيل الإجراء بنجاح')
    setActionModal(null)
    setActionText('')
    fetchAlerts()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">التنبيهات والإنذارات</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            نظام التصعيد التلقائي حسب ميثاق الالتزام والانضباط
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

      {/* Summary Cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[1, 2, 3].map(level => {
          const config = levelConfig[level]
          const count = alerts.filter(a => a.level === level).length
          const pending = alerts.filter(a => a.level === level && a.status === 'pending').length
          return (
            <div key={level} style={{
              background: config.bg, borderRadius: 12, padding: 16,
              border: `1px solid ${config.border}`, cursor: 'pointer'
            }} onClick={() => setFilterLevel(filterLevel == level ? '' : String(level))}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{config.icon}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: config.color }}>{config.name}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: config.color }}>{count}</div>
              {pending > 0 && (
                <div style={{ fontSize: 12, color: config.color, fontWeight: 600, marginTop: 4 }}>
                  {pending} بانتظار الإجراء
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select className="form-control" style={{ width: 180 }} value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}>
          <option value="">جميع المستويات</option>
          <option value="1">تنبيه</option>
          <option value="2">إنذار</option>
          <option value="3">قرار</option>
        </select>
        <select className="form-control" style={{ width: 180 }} value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">جميع الحالات</option>
          <option value="pending">بانتظار الإجراء</option>
          <option value="done">تم الإجراء</option>
        </select>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>جاري التحميل...</div>
      ) : alerts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map(alert => {
            const config = levelConfig[alert.level]
            return (
              <div key={alert.id} style={{
                background: 'white', borderRadius: 12, overflow: 'hidden',
                border: `1px solid ${config.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                borderRight: `5px solid ${config.color}`
              }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        background: config.bg, color: config.color,
                        padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700
                      }}>
                        {config.icon} {alert.level_name}
                      </span>
                      <span style={{
                        background: alert.status === 'pending' ? '#FFF3E0' : '#E8F5E9',
                        color: alert.status === 'pending' ? '#F57C00' : '#2E7D32',
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
                      }}>
                        {alert.status === 'pending' ? '⏳ بانتظار الإجراء' : '✅ تم الإجراء'}
                      </span>
                      {alert.trigger_type === 'auto' && (
                        <span style={{ fontSize: 11, color: 'var(--text-light)', background: 'var(--border-light)', padding: '3px 8px', borderRadius: 10 }}>
                          تلقائي
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{alert.created_at?.split('T')[0] || alert.created_at}</span>
                      <button onClick={async () => {
                        if (!confirm('هل أنت متأكد من حذف هذا التنبيه/الإنذار؟')) return
                        try {
                          await api.delete(`/alerts/${alert.id}`)
                          showToast('تم الحذف')
                          fetchAlerts()
                        } catch { showToast('حدث خطأ', 'error') }
                      }} style={{ background: 'none', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 4 }}>
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Student */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${alert.student_id}`)}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{alert.student_name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 8 }}>— {alert.circle_name}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {alert.reason}
                  </div>

                  {/* Action taken */}
                  {alert.status === 'done' && alert.action_taken && (
                    <div style={{
                      background: '#E8F5E9', borderRadius: 8, padding: '10px 14px',
                      marginTop: 8, borderRight: '3px solid #2E7D32'
                    }}>
                      <div style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600, marginBottom: 2 }}>✅ الإجراء المتخذ:</div>
                      <div style={{ fontSize: 13 }}>{alert.action_taken}</div>
                      {alert.action_date && <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{alert.action_date}</div>}
                    </div>
                  )}

                  {/* Action buttons for pending - with quick actions */}
                  {alert.status === 'pending' && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm" onClick={async () => {
                        await api.put(`/alerts/${alert.id}`, { status: 'done', action_taken: 'تم التواصل مع ولي الأمر', action_date: new Date().toISOString().split('T')[0] })
                        showToast('تم تسجيل الإجراء')
                        fetchAlerts()
                      }} style={{ background: '#E3F2FD', color: '#1565C0' }}>
                        📞 تم التواصل مع ولي الأمر
                      </button>
                      <button className="btn btn-sm" onClick={async () => {
                        await api.put(`/alerts/${alert.id}`, { status: 'done', action_taken: 'تم تنبيه الطالب', action_date: new Date().toISOString().split('T')[0] })
                        showToast('تم تسجيل الإجراء')
                        fetchAlerts()
                      }} style={{ background: '#FFF3E0', color: '#E65100' }}>
                        ⚠️ تم تنبيه الطالب
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => { setActionModal(alert.id); setActionText('') }}>
                        <FiCheck size={14} /> إجراء آخر
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card empty-state">
          <h3>لا توجد تنبيهات أو إنذارات</h3>
          <p>سيتم إنشاء التنبيهات تلقائياً عند تكرار المخالفات حسب قواعد الميثاق</p>
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
              <label>وصف الإجراء المتخذ</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="مثال: تم الاتصال بولي الأمر ومناقشة الوضع..."
                value={actionText}
                onChange={e => setActionText(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>تاريخ الإجراء</label>
              <input type="date" className="form-control" value={actionDate}
                onChange={e => setActionDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => handleMarkDone(actionModal)}>
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
