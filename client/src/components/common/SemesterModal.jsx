import { FiCalendar, FiLayers } from 'react-icons/fi'
import { useSemester } from '../../context/SemesterContext'

export default function SemesterModal() {
  const { semesters, confirmChoice, loading } = useSemester()

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content" style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)',
            color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FiCalendar size={28} />
          </div>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>اختر الفصل الدراسي</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 22 }}>
          حدّد الفصل الذي تريد إدخال بياناته وعرض تقاريره
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading && <div style={{ color: 'var(--text-secondary)' }}>جارٍ التحميل…</div>}

          {semesters.map(s => (
            <button
              key={s.id}
              onClick={() => confirmChoice(String(s.id))}
              className="semester-choice"
              style={{
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'right',
                padding: '16px 18px', borderRadius: 'var(--radius)',
                border: `2px solid ${s.is_current ? 'var(--primary)' : 'var(--border)'}`,
                background: s.is_current ? 'var(--primary-lighter)' : 'white',
                cursor: 'pointer', transition: 'var(--transition)',
              }}
            >
              <FiCalendar size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {s.name} {s.is_current ? <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--success)',
                    background: 'var(--success-light)', padding: '2px 8px', borderRadius: 12, marginRight: 6
                  }}>الحالي</span> : null}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.hijri} — {s.gregorian}</div>
              </div>
            </button>
          ))}

          <button
            onClick={() => confirmChoice('all')}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'right',
              padding: '16px 18px', borderRadius: 'var(--radius)',
              border: '2px solid var(--border)', background: 'white',
              cursor: 'pointer', transition: 'var(--transition)',
            }}
          >
            <FiLayers size={22} color="var(--info)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>عام — كل الفصول الدراسية</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>كل البيانات والتقارير منذ إنشاء المنصة</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
