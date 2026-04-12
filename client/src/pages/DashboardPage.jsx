import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2'
import { FiUsers, FiBookOpen, FiThumbsUp, FiThumbsDown, FiAlertTriangle } from 'react-icons/fi'
import api from '../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)
ChartJS.defaults.font.family = 'Tajawal'

export default function DashboardPage() {
  const [overview, setOverview] = useState(null)
  const [byCircle, setByCircle] = useState([])
  const [byType, setByType] = useState([])
  const [byMonth, setByMonth] = useState([])
  const [completion, setCompletion] = useState(null)
  const [recentBehaviors, setRecentBehaviors] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/stats/overview').then(r => setOverview(r.data))
    api.get('/stats/behaviors-by-circle').then(r => setByCircle(r.data))
    api.get('/stats/behaviors-by-type').then(r => setByType(r.data))
    api.get('/stats/behaviors-by-month').then(r => setByMonth(r.data))
    api.get('/stats/action-completion').then(r => setCompletion(r.data))
    api.get('/behaviors?limit=10').then(r => setRecentBehaviors(r.data))
  }, [])

  const circleNames = [...new Set(byCircle.map(d => d.circle_name))]
  const circleChartData = {
    labels: circleNames,
    datasets: [
      {
        label: 'إيجابي',
        data: circleNames.map(n => byCircle.find(d => d.circle_name === n && d.type === 'positive')?.count || 0),
        backgroundColor: '#4CAF50',
        borderRadius: 6,
      },
      {
        label: 'سلبي',
        data: circleNames.map(n => byCircle.find(d => d.circle_name === n && d.type === 'negative')?.count || 0),
        backgroundColor: '#EF5350',
        borderRadius: 6,
      }
    ]
  }

  const typeChartData = {
    labels: ['إيجابي', 'سلبي'],
    datasets: [{
      data: [
        byType.find(d => d.type === 'positive')?.count || 0,
        byType.find(d => d.type === 'negative')?.count || 0
      ],
      backgroundColor: ['#4CAF50', '#EF5350'],
      borderWidth: 0,
    }]
  }

  const months = [...new Set(byMonth.map(d => d.month))].sort()
  const monthChartData = {
    labels: months,
    datasets: [
      {
        label: 'إيجابي',
        data: months.map(m => byMonth.find(d => d.month === m && d.type === 'positive')?.count || 0),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'سلبي',
        data: months.map(m => byMonth.find(d => d.month === m && d.type === 'negative')?.count || 0),
        borderColor: '#EF5350',
        backgroundColor: 'rgba(239, 83, 80, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  }

  const completionChartData = {
    labels: ['تم اتخاذ إجراء', 'بدون إجراء'],
    datasets: [{
      data: [completion?.with_actions || 0, completion?.without_actions || 0],
      backgroundColor: ['#1565C0', '#FFB74D'],
      borderWidth: 0,
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', rtl: true } }
  }

  const barOptions = {
    ...chartOptions,
    indexAxis: 'y',
    scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>لوحة التحكم</h1>

      {/* Pending Alerts Banner */}
      {overview?.pending_alerts > 0 && (
        <div onClick={() => navigate('/alerts')} style={{
          background: 'linear-gradient(135deg, #FFF3E0, #FFECB3)', border: '2px solid #FFE082',
          borderRadius: 12, padding: 16, marginBottom: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiAlertTriangle size={24} color="#F57C00" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#E65100' }}>
                {overview.pending_alerts} تنبيه/إنذار بانتظار إجراءك
              </div>
              <div style={{ fontSize: 13, color: '#BF360C' }}>اضغط هنا للمراجعة واتخاذ الإجراء المناسب</div>
            </div>
          </div>
          <span style={{ fontSize: 20 }}>←</span>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#E3F2FD', borderRadius: 10, padding: 10 }}><FiUsers size={20} color="#1565C0" /></div>
            <div>
              <div className="stat-value" style={{ color: '#1565C0', fontSize: 28 }}>{overview?.total_students || 0}</div>
              <div className="stat-label">الطلاب</div>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#F3E5F5', borderRadius: 10, padding: 10 }}><FiBookOpen size={20} color="#7B1FA2" /></div>
            <div>
              <div className="stat-value" style={{ color: '#7B1FA2', fontSize: 28 }}>{overview?.total_circles || 0}</div>
              <div className="stat-label">الحلقات</div>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#E8F5E9', borderRadius: 10, padding: 10 }}><FiThumbsUp size={20} color="#2E7D32" /></div>
            <div>
              <div className="stat-value" style={{ color: '#2E7D32', fontSize: 28 }}>{overview?.positive_behaviors || 0}</div>
              <div className="stat-label">إيجابي</div>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#FFEBEE', borderRadius: 10, padding: 10 }}><FiThumbsDown size={20} color="#D32F2F" /></div>
            <div>
              <div className="stat-value" style={{ color: '#D32F2F', fontSize: 28 }}>{overview?.negative_behaviors || 0}</div>
              <div className="stat-label">سلبي</div>
            </div>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/alerts')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#FFF3E0', borderRadius: 10, padding: 10 }}><FiAlertTriangle size={20} color="#F57C00" /></div>
            <div>
              <div className="stat-value" style={{ color: '#F57C00', fontSize: 28 }}>{overview?.pending_alerts || 0}</div>
              <div className="stat-label">تنبيهات معلقة</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>السلوكيات حسب الحلقة</h3>
          <div style={{ height: Math.max(300, circleNames.length * 40) }}>
            {circleNames.length > 0 ? <Bar data={circleChartData} options={barOptions} /> :
              <p style={{ textAlign: 'center', color: 'var(--text-light)', paddingTop: 60 }}>لا توجد بيانات بعد</p>}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>توزيع السلوكيات</h3>
          <div style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <Doughnut data={typeChartData} options={{ ...chartOptions, cutout: '60%' }} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>السلوكيات حسب الشهر</h3>
          <div style={{ height: 300 }}>
            {months.length > 0 ? <Line data={monthChartData} options={chartOptions} /> :
              <p style={{ textAlign: 'center', color: 'var(--text-light)', paddingTop: 60 }}>لا توجد بيانات بعد</p>}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>نسبة اتخاذ الإجراءات</h3>
          <div style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <Pie data={completionChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Recent Behaviors */}
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 16 }}>آخر السلوكيات المسجلة</h3>
        {recentBehaviors.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الحلقة</th>
                  <th>النوع</th>
                  <th>الوصف</th>
                  <th>التاريخ</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {recentBehaviors.map(b => (
                  <tr key={b.id} onClick={() => navigate(`/students/${b.student_id}`)}>
                    <td style={{ fontWeight: 600 }}>{b.student_name}</td>
                    <td>{b.circle_name}</td>
                    <td><span className={`badge badge-${b.type}`}>{b.type === 'positive' ? 'إيجابي' : 'سلبي'}</span></td>
                    <td>{b.description}</td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{b.date}</td>
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
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: 40 }}>لم يتم تسجيل أي سلوكيات بعد. ابدأ بتسجيل سلوك جديد.</p>
        )}
      </div>
    </div>
  )
}
