import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { FiUsers, FiBookOpen, FiThumbsDown, FiAlertTriangle } from 'react-icons/fi'
import api from '../services/api'
import { formatArabicDate } from '../utils/dateFormat'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)
ChartJS.defaults.font.family = 'Tajawal'

export default function DashboardPage() {
  const [overview, setOverview] = useState(null)
  const [byCircle, setByCircle] = useState([])
  const [byMonth, setByMonth] = useState([])
  const [completion, setCompletion] = useState(null)
  const [recentBehaviors, setRecentBehaviors] = useState([])
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  const navigate = useNavigate()

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    api.get('/stats/overview').then(r => setOverview(r.data))
    api.get('/stats/behaviors-by-circle').then(r => setByCircle(r.data))
    api.get('/stats/behaviors-by-month').then(r => setByMonth(r.data))
    api.get('/stats/action-completion').then(r => setCompletion(r.data))
    api.get('/behaviors?limit=10').then(r => setRecentBehaviors(r.data))
  }, [])

  const circleNames = [...new Set(byCircle.map(d => d.circle_name))]
  const circleChartData = {
    labels: circleNames,
    datasets: [
      { label: 'المخالفات', data: circleNames.map(n => byCircle.find(d => d.circle_name === n)?.count || 0), backgroundColor: '#EF5350', borderRadius: 6 }
    ]
  }

  const months = [...new Set(byMonth.map(d => d.month))].sort()
  const monthChartData = {
    labels: months,
    datasets: [
      { label: 'المخالفات', data: months.map(m => byMonth.find(d => d.month === m)?.count || 0), borderColor: '#EF5350', backgroundColor: 'rgba(239, 83, 80, 0.1)', fill: true, tension: 0.4 }
    ]
  }

  const completionChartData = {
    labels: ['تم اتخاذ إجراء', 'بدون إجراء'],
    datasets: [{ data: [completion?.with_actions || 0, completion?.without_actions || 0], backgroundColor: ['#1565C0', '#FFB74D'], borderWidth: 0 }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        rtl: true,
        labels: { font: { size: isMobile ? 11 : 13 }, padding: isMobile ? 8 : 12 }
      }
    }
  }
  const barOptions = {
    ...chartOptions,
    indexAxis: 'y',
    scales: {
      x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: isMobile ? 10 : 12 } } },
      y: { ticks: { font: { size: isMobile ? 10 : 12 } } }
    }
  }

  const stats = [
    { value: overview?.total_students || 0, label: 'الطلاب', color: '#1565C0', bg: '#E3F2FD', icon: FiUsers },
    { value: overview?.total_circles || 0, label: 'الحلقات', color: '#7B1FA2', bg: '#F3E5F5', icon: FiBookOpen },
    { value: overview?.negative_behaviors || 0, label: 'مخالفات', color: '#D32F2F', bg: '#FFEBEE', icon: FiThumbsDown },
    { value: overview?.pending_alerts || 0, label: 'معلقة', color: '#F57C00', bg: '#FFF3E0', icon: FiAlertTriangle, onClick: () => navigate('/records') },
  ]

  const barHeight = isMobile ? Math.max(220, circleNames.length * 28) : Math.max(250, circleNames.length * 35)
  const chartHeight = isMobile ? 220 : 250

  return (
    <div className="dashboard-page">
      <h1 className="page-title" style={{ marginBottom: 16 }}>لوحة التحكم</h1>

      {overview?.pending_alerts > 0 && (
        <div onClick={() => navigate('/records')} className="alerts-banner">
          <div className="alerts-banner-content">
            <FiAlertTriangle size={isMobile ? 20 : 22} color="#F57C00" style={{ flexShrink: 0 }} />
            <div>
              <div className="alerts-banner-title">
                {overview.pending_alerts} تنبيه/إنذار بانتظار إجراءك
              </div>
              <div className="alerts-banner-sub">اضغط هنا للمراجعة</div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="dashboard-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card dash-stat" onClick={s.onClick} style={s.onClick ? { cursor: 'pointer' } : {}}>
            <div className="dash-stat-icon" style={{ background: s.bg }}>
              <s.icon size={isMobile ? 16 : 18} color={s.color} />
            </div>
            <div className="dash-stat-text">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 10, fontSize: isMobile ? 14 : 15 }}>المخالفات حسب الحلقة</h3>
          <div style={{ height: barHeight, width: '100%' }}>
            {circleNames.length > 0 ? <Bar data={circleChartData} options={barOptions} /> :
              <p style={{ textAlign: 'center', color: 'var(--text-light)', paddingTop: 40 }}>لا توجد بيانات بعد</p>}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10, fontSize: isMobile ? 14 : 15 }}>نسبة اتخاذ الإجراءات</h3>
          <div style={{ height: chartHeight, display: 'flex', justifyContent: 'center' }}>
            <Pie data={completionChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10, fontSize: isMobile ? 14 : 15 }}>المخالفات حسب الشهر</h3>
        <div style={{ height: chartHeight, width: '100%' }}>
          {months.length > 0 ? <Line data={monthChartData} options={chartOptions} /> :
            <p style={{ textAlign: 'center', color: 'var(--text-light)', paddingTop: 40 }}>لا توجد بيانات بعد</p>}
        </div>
      </div>

      {/* Recent Behaviors */}
      <div className="card">
        <h3 style={{ marginBottom: 10, fontSize: isMobile ? 14 : 15 }}>آخر المخالفات المسجلة</h3>
        {recentBehaviors.length > 0 ? (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentBehaviors.map(b => (
                <div key={b.id} onClick={() => navigate(`/students/${b.student_id}`)} style={{
                  padding: 10, borderRadius: 8, background: 'var(--bg)', cursor: 'pointer',
                  borderRight: '3px solid #D32F2F'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{b.student_name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {b.circle_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>{b.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-light)' }}>{formatArabicDate(b.date)}</span>
                    {b.action_count > 0 ?
                      <span className="badge badge-done" style={{ fontSize: 10 }}>تم ({b.action_count})</span> :
                      <span className="badge badge-pending" style={{ fontSize: 10 }}>بانتظار</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>الحلقة</th>
                    <th>المخالفة</th>
                    <th>التاريخ</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBehaviors.map(b => (
                    <tr key={b.id} onClick={() => navigate(`/students/${b.student_id}`)}>
                      <td style={{ fontWeight: 600 }}>{b.student_name}</td>
                      <td>{b.circle_name}</td>
                      <td>{b.description}</td>
                      <td>{formatArabicDate(b.date)}</td>
                      <td>
                        {b.action_count > 0 ?
                          <span className="badge badge-done">تم ({b.action_count})</span> :
                          <span className="badge badge-pending">بانتظار</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: 30 }}>لم يتم تسجيل أي مخالفات بعد. ابدأ بتسجيل مخالفة جديدة.</p>
        )}
      </div>
    </div>
  )
}
