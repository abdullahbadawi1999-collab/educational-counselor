import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FiPhone, FiArrowRight, FiPlus, FiCheck, FiCalendar, FiAlertTriangle, FiDownload, FiCpu, FiTrash2, FiSend, FiMessageCircle, FiX, FiEdit2, FiFileText } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import api from '../services/api'
import { generateStudentExcel } from '../services/excelExport'
import { generateStudentPDF } from '../services/pdfExport'
import { formatArabicDate } from '../utils/dateFormat'

const levelConfig = {
  1: { name: 'تنبيه', color: '#1565C0', bg: '#E3F2FD', icon: '📞' },
  2: { name: 'إنذار', color: '#F57C00', bg: '#FFF3E0', icon: '⚠️' },
  3: { name: 'قرار', color: '#D32F2F', bg: '#FFEBEE', icon: '🚦' }
}

const QUICK_ACTIONS = [
  'تم التواصل مع ولي الأمر',
  'تم تنبيه الطالب',
]

export default function StudentDetailPage({ showToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [behaviors, setBehaviors] = useState([])
  const [alerts, setAlerts] = useState([])
  const [escalation, setEscalation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showActionModal, setShowActionModal] = useState(null)
  const [actionDesc, setActionDesc] = useState('')
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0])
  const [showAlertActionModal, setShowAlertActionModal] = useState(null)
  const [alertActionText, setAlertActionText] = useState('')
  const [editActionModal, setEditActionModal] = useState(null) // { id, description, action_date }
  const [showAiChat, setShowAiChat] = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [editBehavior, setEditBehavior] = useState(null) // behavior object being edited
  const [behaviorTypes, setBehaviorTypes] = useState([])
  const [editForm, setEditForm] = useState({ type: '', behavior_type_id: '', description: '', date: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      const [sRes, bRes, aRes, eRes] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/students/${id}/behaviors`),
        api.get(`/alerts/student/${id}`),
        api.get(`/alerts/escalation/${id}`)
      ])
      setStudent(sRes.data)
      setBehaviors(bRes.data)
      setAlerts(aRes.data)
      setEscalation(eRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])
  useEffect(() => {
    api.get('/behaviors/types').then(r => setBehaviorTypes(r.data)).catch(() => {})
  }, [])

  const openEditBehavior = (b) => {
    setEditBehavior(b)
    // Find behavior_type_id from list by matching name (since behavior endpoint returns behavior_type_name)
    let btId = ''
    if (b.behavior_type_name) {
      const bt = behaviorTypes.find(t => t.name === b.behavior_type_name && t.type === b.type)
      if (bt) btId = bt.id
    }
    setEditForm({
      type: b.type,
      behavior_type_id: btId,
      description: b.description,
      date: b.date
    })
  }

  const handleEditSubmit = async () => {
    if (!editForm.type || !editForm.description.trim() || !editForm.date) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error')
      return
    }
    setEditSubmitting(true)
    try {
      const res = await api.put(`/behaviors/${editBehavior.id}`, {
        type: editForm.type,
        behavior_type_id: editForm.behavior_type_id || null,
        description: editForm.description.trim(),
        date: editForm.date
      })
      let msg = 'تم التحديث بنجاح'
      if (res.data.recalculated) {
        if (res.data.removed_alerts > 0) {
          msg += ` — تم حذف ${res.data.removed_alerts} تنبيه مرتبط`
        }
        if (res.data.generated_alert) {
          msg += ` — تم إنشاء ${res.data.generated_alert.level_name} جديد`
        }
      }
      showToast(msg)
      setEditBehavior(null)
      fetchData()
    } catch {
      showToast('حدث خطأ في التحديث', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleAddAction = async (behaviorId) => {
    if (!actionDesc.trim()) return
    try {
      await api.post('/actions', { behavior_id: behaviorId, description: actionDesc, action_date: actionDate })
      showToast('تم إضافة الإجراء بنجاح')
      setShowActionModal(null)
      setActionDesc('')
      setActionDate(new Date().toISOString().split('T')[0])
      fetchData()
    } catch { showToast('حدث خطأ', 'error') }
  }

  const handleAlertAction = async (alertId) => {
    if (!alertActionText.trim()) return
    try {
      await api.put(`/alerts/${alertId}`, {
        status: 'done', action_taken: alertActionText.trim(),
        action_date: new Date().toISOString().split('T')[0]
      })
      showToast('تم تسجيل الإجراء')
      setShowAlertActionModal(null)
      setAlertActionText('')
      fetchData()
    } catch { showToast('حدث خطأ', 'error') }
  }

  const handleDeleteBehavior = async (behaviorId) => {
    if (!confirm('هل أنت متأكد من حذف هذا السلوك؟ سيتم حذف جميع الإجراءات المرتبطة به.')) return
    try {
      await api.delete(`/behaviors/${behaviorId}`)
      showToast('تم حذف السلوك')
      fetchData()
    } catch { showToast('حدث خطأ', 'error') }
  }

  const handleExportExcel = async () => {
    try {
      const res = await api.get(`/reports/data?scope=student&student_id=${id}`)
      generateStudentExcel(res.data)
      showToast('تم تصدير التقرير بنجاح')
    } catch (err) {
      console.error('Excel export error:', err)
      showToast('حدث خطأ في التصدير', 'error')
    }
  }

  const handleExportPDF = async () => {
    try {
      const res = await api.get(`/reports/data?scope=student&student_id=${id}`)
      await generateStudentPDF(res.data)
      showToast('تم تصدير التقرير بنجاح')
    } catch (err) {
      console.error('PDF export error:', err)
      showToast('حدث خطأ في التصدير', 'error')
    }
  }

  const handleRecalculate = async () => {
    if (!confirm('سيتم إعادة حساب التنبيهات والإنذارات حسب قواعد الميثاق. متابعة؟')) return
    try {
      const res = await api.post(`/alerts/recalculate/${id}`)
      showToast(`تم إعادة الحساب (${res.data.regenerated} سجل)`)
      fetchData()
    } catch { showToast('حدث خطأ', 'error') }
  }

  const openAiChat = () => {
    setShowAiChat(true)
    if (aiMessages.length === 0) {
      // Send initial greeting
      sendAiMessage('مرحبا')
    }
  }

  const sendAiMessage = async (msg) => {
    const userMsg = msg || aiInput.trim()
    if (!userMsg) return

    const newMessages = [...aiMessages, { role: 'user', text: userMsg }]
    setAiMessages(newMessages)
    setAiInput('')
    setAiLoading(true)

    try {
      const res = await api.post('/ai/chat', {
        student_id: id,
        message: userMsg,
        history: newMessages
      })
      setAiMessages([...newMessages, { role: 'ai', text: res.data.response }])
    } catch {
      setAiMessages([...newMessages, { role: 'ai', text: 'حدث خطأ. حاول مرة أخرى.' }])
    } finally {
      setAiLoading(false)
    }
  }

  const PhoneLink = ({ phone }) => {
    if (!phone) return <span style={{ color: 'var(--text-light)' }}>غير متوفر</span>
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href={`tel:${phone}`} className="phone-link" style={{ fontSize: 15, fontWeight: 600 }}>
          <FiPhone size={14} />{phone}
        </a>
        <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer"
          style={{ background: '#25D366', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <FaWhatsapp size={14} /> واتساب
        </a>
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>جاري التحميل...</div>
  if (!student) return <div style={{ textAlign: 'center', padding: 60 }}>الطالب غير موجود</div>

  const pendingAlerts = alerts.filter(a => a.status === 'pending')

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>
            <FiArrowRight size={16} /> رجوع
          </button>
          <div>
            <h1 className="page-title" style={{ marginBottom: 2 }}>{student.name}</h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{student.circle_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>المعلم: {student.teacher_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={handleExportExcel}>
            <FiDownload size={14} /> Excel
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleExportPDF}>
            <FiFileText size={14} /> PDF
          </button>
          <button className="btn btn-sm" onClick={openAiChat}
            style={{ background: '#7C3AED', color: 'white' }}>
            <FiMessageCircle size={14} /> استشارة ذكية
          </button>
        </div>
      </div>

      {/* AI Chat Window */}
      {showAiChat && (
        <div className="card" style={{ marginBottom: 20, borderRight: '4px solid #7C3AED', padding: 0, overflow: 'hidden' }}>
          {/* Chat Header */}
          <div style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)', color: 'white', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FiCpu size={20} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>المستشار التربوي الذكي</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>مساعدك في توجيه الطالب {student.name}</div>
              </div>
            </div>
            <button onClick={() => setShowAiChat(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
              <FiX size={18} />
            </button>
          </div>

          {/* Chat Messages */}
          <div style={{ height: 380, overflowY: 'auto', padding: 16, background: '#FAFAFA' }}>
            {aiMessages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 16px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#7C3AED' : 'white',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  fontSize: 14,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-line',
                  boxShadow: msg.role === 'ai' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: msg.role === 'ai' ? '1px solid var(--border-light)' : 'none'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                <div style={{ background: 'white', padding: '10px 16px', borderRadius: '16px 16px 16px 4px', fontSize: 14, color: 'var(--text-light)', border: '1px solid var(--border-light)' }}>
                  جاري التحليل...
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggestions */}
          <div style={{ padding: '8px 16px', background: '#F3F4F6', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['تقييم', 'حضور', 'سلوك', 'حفظ', 'تحفيز', 'خطة', 'تواصل'].map(q => (
              <button key={q} onClick={() => sendAiMessage(q)} disabled={aiLoading}
                style={{ padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 500, background: 'white', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {q}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              className="form-control"
              placeholder="اكتب سؤالك هنا..."
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !aiLoading) sendAiMessage() }}
              style={{ flex: 1 }}
            />
            <button onClick={() => sendAiMessage()} disabled={aiLoading || !aiInput.trim()}
              style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <FiSend size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Pending Alerts Banner */}
      {pendingAlerts.length > 0 && (
        <div style={{ background: '#FFF3E0', border: '2px solid #FFE0B2', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FiAlertTriangle size={20} color="#F57C00" />
            <span style={{ fontWeight: 700, color: '#E65100', fontSize: 15 }}>
              {pendingAlerts.length} تنبيه/إنذار بانتظار الإجراء
            </span>
          </div>
          {pendingAlerts.map(alert => {
            const config = levelConfig[alert.level]
            return (
              <div key={alert.id} style={{
                background: 'white', borderRadius: 8, padding: 12, marginBottom: 8,
                borderRight: `4px solid ${config.color}`, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
              }}>
                <div>
                  <span style={{ background: config.bg, color: config.color, padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                    {config.icon} {alert.level_name}
                  </span>
                  <span style={{ fontSize: 13, marginRight: 10 }}>{alert.reason}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {QUICK_ACTIONS.map(qa => (
                    <button key={qa} className="btn btn-sm" onClick={async () => {
                      await api.put(`/alerts/${alert.id}`, { status: 'done', action_taken: qa, action_date: new Date().toISOString().split('T')[0] })
                      showToast('تم تسجيل الإجراء')
                      fetchData()
                    }} style={{ background: config.bg, color: config.color, fontSize: 12 }}>
                      {qa}
                    </button>
                  ))}
                  <button className="btn btn-primary btn-sm"
                    onClick={() => { setShowAlertActionModal(alert.id); setAlertActionText('') }}>
                    إجراء آخر
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Student Info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="student-info-grid">
          <div className="info-item"><div className="label">الحلقة</div><div className="value">{student.circle_name}</div></div>
          <div className="info-item"><div className="label">المعلم</div><div className="value">{student.teacher_name}</div></div>
          <div className="info-item"><div className="label">موبايل الطالب</div><div className="value"><PhoneLink phone={student.student_phone} /></div></div>
          <div className="info-item"><div className="label">موبايل ولي الأمر</div><div className="value"><PhoneLink phone={student.parent_phone_1} /></div></div>
          <div className="info-item"><div className="label">موبايل ولي الأمر 2</div><div className="value"><PhoneLink phone={student.parent_phone_2} /></div></div>
        </div>
      </div>

      {/* Escalation Status */}
      {escalation && escalation.behavior_counts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiAlertTriangle size={18} color="#F57C00" /> حالة التصعيد (حسب الميثاق)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {escalation.behavior_counts.map((bc, i) => {
              const rule = bc.escalation_rule
              let statusColor = '#2E7D32', statusText = 'طبيعي'
              if (rule) {
                if (rule.decision_at && bc.count >= rule.decision_at) { statusColor = '#D32F2F'; statusText = '🚦 قرار' }
                else if (rule.warning_at && bc.count >= rule.warning_at) { statusColor = '#F57C00'; statusText = '⚠️ إنذار' }
                else if (rule.alert_at && bc.count >= rule.alert_at) { statusColor = '#1565C0'; statusText = '📞 تنبيه' }
              }
              return (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', borderRight: `3px solid ${statusColor}`, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{bc.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: statusColor }}>{bc.count}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: statusColor + '15', color: statusColor }}>{statusText}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerts History */}
      {alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>سجل التنبيهات والإنذارات ({alerts.length})</h3>
          {alerts.map(alert => {
            const config = levelConfig[alert.level]
            return (
              <div key={alert.id} style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 8, background: config.bg, borderRight: `3px solid ${config.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                  <span style={{ fontWeight: 700, color: config.color, fontSize: 14 }}>{config.icon} {alert.level_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: alert.status === 'pending' ? '#FFF3E0' : '#E8F5E9', color: alert.status === 'pending' ? '#F57C00' : '#2E7D32' }}>
                      {alert.status === 'pending' ? '⏳ بانتظار' : '✅ تم'}
                    </span>
                    <button onClick={async () => {
                      if (!confirm('هل أنت متأكد من حذف هذا التنبيه/الإنذار؟')) return
                      try {
                        await api.delete(`/alerts/${alert.id}`)
                        showToast('تم الحذف')
                        fetchData()
                      } catch { showToast('حدث خطأ', 'error') }
                    }} style={{ background: 'none', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 2 }}>
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13 }}>{alert.reason}</div>
                {alert.action_taken && (
                  <div style={{ fontSize: 12, color: '#2E7D32', marginTop: 4, fontWeight: 500 }}>✅ {alert.action_taken} {alert.action_date && `(${formatArabicDate(alert.action_date)})`}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Behaviors Header */}
      <div className="page-header">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>سجل السلوكيات ({behaviors.length})</h2>
        <button className="btn btn-primary" onClick={() => navigate(`/behaviors/new?student=${id}`)}>
          <FiPlus size={16} /> تسجيل سلوك
        </button>
      </div>

      {/* Behaviors Timeline */}
      {behaviors.length > 0 ? (
        <div className="timeline">
          {behaviors.map(b => (
            <div key={b.id} className={`timeline-item ${b.type}`}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span className={`badge badge-${b.type}`}>{b.type === 'positive' ? 'إيجابي' : 'سلبي'}</span>
                    <span className="timeline-date" style={{ marginRight: 12 }}><FiCalendar size={12} style={{ marginLeft: 4 }} />{formatArabicDate(b.date)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {QUICK_ACTIONS.map(qa => (
                      <button key={qa} className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={async () => {
                          await api.post('/actions', { behavior_id: b.id, description: qa, action_date: new Date().toISOString().split('T')[0] })
                          showToast('تم تسجيل الإجراء')
                          fetchData()
                        }}>
                        {qa}
                      </button>
                    ))}
                    <button className="btn btn-outline btn-sm" onClick={() => { setShowActionModal(b.id); setActionDesc('') }}>
                      <FiPlus size={14} /> إجراء آخر
                    </button>
                    <button className="btn btn-sm" style={{ color: '#1565C0', background: '#E3F2FD' }}
                      onClick={() => openEditBehavior(b)}>
                      <FiEdit2 size={14} />
                    </button>
                    <button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'var(--danger-light)' }}
                      onClick={() => handleDeleteBehavior(b.id)}>
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{b.description}</p>
                {b.actions && b.actions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                      <FiCheck size={14} style={{ marginLeft: 4 }} />الإجراءات المتخذة:
                    </div>
                    {b.actions.map(a => (
                      <div key={a.id} className="action-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{a.description}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{formatArabicDate(a.action_date)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => setEditActionModal({ id: a.id, description: a.description, action_date: a.action_date })}
                            style={{ background: 'var(--info-light)', border: 'none', color: 'var(--info)', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                            title="تعديل">
                            <FiEdit2 size={13} />
                          </button>
                          <button onClick={async () => {
                            if (!confirm('هل أنت متأكد من حذف هذا الإجراء؟')) return
                            try {
                              await api.delete(`/actions/${a.id}`)
                              showToast('تم حذف الإجراء')
                              fetchData()
                            } catch { showToast('حدث خطأ', 'error') }
                          }} style={{ background: 'var(--danger-light)', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                            title="حذف">
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {b.actions && b.actions.length === 0 && <span className="badge badge-pending">لم يتم اتخاذ إجراء بعد</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card empty-state">
          <h3>لا توجد سلوكيات مسجلة</h3>
          <p>اضغط على "تسجيل سلوك" لإضافة ملاحظة جديدة</p>
        </div>
      )}

      {/* Behavior Action Modal */}
      {showActionModal && (
        <div className="modal-overlay" onClick={() => setShowActionModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة إجراء</h2>
              <button className="modal-close" onClick={() => setShowActionModal(null)}>&times;</button>
            </div>
            <div className="form-group">
              <label>إجراء سريع</label>
              <div className="chip-group">
                {QUICK_ACTIONS.map(qa => (
                  <button key={qa} className={`chip ${actionDesc === qa ? 'active' : ''}`}
                    onClick={() => setActionDesc(qa)}>{qa}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>أو اكتب إجراء آخر</label>
              <textarea className="form-control" rows={2} placeholder="اكتب الإجراء المتخذ..."
                value={actionDesc} onChange={e => setActionDesc(e.target.value)} />
            </div>
            <div className="form-group">
              <label>التاريخ</label>
              <input type="date" className="form-control" value={actionDate} onChange={e => setActionDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => handleAddAction(showActionModal)}><FiCheck size={16} /> حفظ</button>
              <button className="btn btn-outline" onClick={() => setShowActionModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Behavior Modal */}
      {editBehavior && (
        <div className="modal-overlay" onClick={() => setEditBehavior(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تعديل السلوك</h2>
              <button className="modal-close" onClick={() => setEditBehavior(null)}>&times;</button>
            </div>

            <div style={{ background: '#FFF3E0', border: '1px solid #FFE082', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#BF360C', lineHeight: 1.7 }}>
              <FiAlertTriangle size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
              عند تعديل نوع السلوك أو تصنيفه، سيتم إعادة حساب التنبيهات والإنذارات المرتبطة تلقائياً (إزالة القديمة وإضافة الجديدة إن لزم).
            </div>

            <div className="form-group">
              <label>نوع السلوك</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-btn positive ${editForm.type === 'positive' ? 'active' : ''}`}
                  onClick={() => setEditForm(f => ({ ...f, type: 'positive', behavior_type_id: '' }))}
                >سلوك إيجابي</button>
                <button
                  type="button"
                  className={`type-btn negative ${editForm.type === 'negative' ? 'active' : ''}`}
                  onClick={() => setEditForm(f => ({ ...f, type: 'negative', behavior_type_id: '' }))}
                >سلوك سلبي / مخالفة</button>
              </div>
            </div>

            {editForm.type && (
              <div className="form-group">
                <label>التصنيف (حسب الميثاق)</label>
                <select className="form-control" value={editForm.behavior_type_id}
                  onChange={e => {
                    const btId = e.target.value
                    const bt = behaviorTypes.find(t => String(t.id) === String(btId))
                    setEditForm(f => ({
                      ...f,
                      behavior_type_id: btId,
                      description: bt ? bt.name : f.description
                    }))
                  }}>
                  <option value="">— بدون تصنيف —</option>
                  {behaviorTypes.filter(bt => bt.type === editForm.type).map(bt => (
                    <option key={bt.id} value={bt.id}>{bt.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>وصف السلوك</label>
              <textarea className="form-control" rows={3}
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="form-group">
              <label>التاريخ</label>
              <input type="date" className="form-control" value={editForm.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleEditSubmit} disabled={editSubmitting}>
                <FiCheck size={16} /> {editSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
              <button className="btn btn-outline" onClick={() => setEditBehavior(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Action Modal */}
      {editActionModal && (
        <div className="modal-overlay" onClick={() => setEditActionModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تعديل الإجراء المتخذ</h2>
              <button className="modal-close" onClick={() => setEditActionModal(null)}>&times;</button>
            </div>
            <div className="form-group">
              <label>إجراء سريع</label>
              <div className="chip-group">
                {QUICK_ACTIONS.map(qa => (
                  <button key={qa} className={`chip ${editActionModal.description === qa ? 'active' : ''}`}
                    onClick={() => setEditActionModal({ ...editActionModal, description: qa })}>{qa}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>وصف الإجراء</label>
              <textarea className="form-control" rows={3}
                value={editActionModal.description}
                onChange={e => setEditActionModal({ ...editActionModal, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>تاريخ الإجراء</label>
              <input type="date" className="form-control"
                value={editActionModal.action_date}
                onChange={e => setEditActionModal({ ...editActionModal, action_date: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={async () => {
                if (!editActionModal.description?.trim()) return
                try {
                  await api.put(`/actions/${editActionModal.id}`, {
                    description: editActionModal.description.trim(),
                    action_date: editActionModal.action_date
                  })
                  showToast('تم تحديث الإجراء')
                  setEditActionModal(null)
                  fetchData()
                } catch { showToast('حدث خطأ', 'error') }
              }}>
                <FiCheck size={16} /> حفظ
              </button>
              <button className="btn btn-outline" onClick={() => setEditActionModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Action Modal */}
      {showAlertActionModal && (
        <div className="modal-overlay" onClick={() => setShowAlertActionModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تسجيل إجراء</h2>
              <button className="modal-close" onClick={() => setShowAlertActionModal(null)}>&times;</button>
            </div>
            <div className="form-group">
              <label>إجراء سريع</label>
              <div className="chip-group">
                {QUICK_ACTIONS.map(qa => (
                  <button key={qa} className={`chip ${alertActionText === qa ? 'active' : ''}`}
                    onClick={() => setAlertActionText(qa)}>{qa}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>أو اكتب إجراء آخر</label>
              <textarea className="form-control" rows={2} placeholder="مثال: تم الاتصال بولي الأمر..."
                value={alertActionText} onChange={e => setAlertActionText(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => handleAlertAction(showAlertActionModal)}><FiCheck size={16} /> حفظ</button>
              <button className="btn btn-outline" onClick={() => setShowAlertActionModal(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
