import { useState, useRef, useEffect } from 'react'
import { FiCalendar, FiChevronDown, FiLayers, FiCheck } from 'react-icons/fi'
import { useSemester } from '../../context/SemesterContext'

export default function TopBar() {
  const { semesters, selected, setSelected, label } = useSemester()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const isAll = selected === 'all'
  const pick = (v) => { setSelected(v); setOpen(false) }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
      marginBottom: 20, gap: 12, flexWrap: 'wrap'
    }} className="topbar">
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px', borderRadius: 999,
            background: isAll ? 'var(--info-light)' : 'var(--primary-light)',
            border: `1.5px solid ${isAll ? 'var(--info)' : 'var(--primary)'}`,
            color: isAll ? 'var(--info)' : 'var(--primary-dark)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          {isAll ? <FiLayers size={16} /> : <FiCalendar size={16} />}
          <span>الفصل: {label}</span>
          <FiChevronDown size={16} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: '110%', right: 0, minWidth: 260,
            background: 'white', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
            zIndex: 500, overflow: 'hidden', padding: 6
          }}>
            {semesters.map(s => (
              <button key={s.id} onClick={() => pick(String(s.id))} style={rowStyle(String(s.id) === String(selected))}>
                <FiCalendar size={16} color="var(--primary)" />
                <span style={{ flex: 1, textAlign: 'right' }}>{s.name} {s.hijri}</span>
                {String(s.id) === String(selected) && <FiCheck size={16} color="var(--primary)" />}
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
            <button onClick={() => pick('all')} style={rowStyle(isAll)}>
              <FiLayers size={16} color="var(--info)" />
              <span style={{ flex: 1, textAlign: 'right' }}>عام — كل الفصول</span>
              {isAll && <FiCheck size={16} color="var(--primary)" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function rowStyle(active) {
  return {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--primary-lighter)' : 'transparent',
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active ? 700 : 500,
    color: 'var(--text-primary)', fontFamily: 'inherit',
  }
}
