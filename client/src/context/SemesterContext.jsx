import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { setApiSemester } from '../services/api'

const SemesterContext = createContext(null)

export function useSemester() {
  const ctx = useContext(SemesterContext)
  if (!ctx) throw new Error('useSemester must be used within SemesterProvider')
  return ctx
}

export function SemesterProvider({ children }) {
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  // 'all' or a numeric id as string. null until resolved on first load.
  const [selected, setSelectedState] = useState(null)

  useEffect(() => {
    api.get('/semesters')
      .then(res => {
        const list = res.data || []
        setSemesters(list)
        // Default to the current semester (the one the user is working on now).
        const current = list.find(s => s.is_current)
        const initial = current ? String(current.id) : 'all'
        setApiSemester(initial)
        setSelectedState(initial)
      })
      .catch(() => { setApiSemester('all'); setSelectedState('all'); setSemesters([]) })
      .finally(() => setLoading(false))
  }, [])

  const setSelected = useCallback((value) => {
    const v = value || 'all'
    setApiSemester(v)
    setSelectedState(v)
  }, [])

  const selectedSemester = (selected && selected !== 'all')
    ? semesters.find(s => String(s.id) === String(selected)) || null
    : null

  const label = selected === 'all'
    ? 'كل الفصول الدراسية'
    : (selectedSemester ? `${selectedSemester.name} ${selectedSemester.hijri}` : '…')

  return (
    <SemesterContext.Provider value={{
      semesters, loading, selected, setSelected, selectedSemester, label,
    }}>
      {children}
    </SemesterContext.Provider>
  )
}
