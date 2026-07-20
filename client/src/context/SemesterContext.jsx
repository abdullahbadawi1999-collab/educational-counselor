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
  // 'all' or a numeric id as string.
  const [selected, setSelectedState] = useState(() => localStorage.getItem('selectedSemester') || 'all')
  // Force the startup chooser once per browser session.
  const [mustChoose, setMustChoose] = useState(() => sessionStorage.getItem('semesterChosen') !== 'true')

  useEffect(() => {
    setApiSemester(selected)
    api.get('/semesters')
      .then(res => setSemesters(res.data || []))
      .catch(() => setSemesters([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSelected = useCallback((value) => {
    const v = value || 'all'
    setApiSemester(v)
    localStorage.setItem('selectedSemester', v)
    setSelectedState(v)
  }, [])

  const confirmChoice = useCallback((value) => {
    setSelected(value)
    sessionStorage.setItem('semesterChosen', 'true')
    setMustChoose(false)
  }, [setSelected])

  const selectedSemester = selected === 'all'
    ? null
    : semesters.find(s => String(s.id) === String(selected)) || null

  const label = selected === 'all'
    ? 'كل الفصول الدراسية'
    : (selectedSemester ? `${selectedSemester.name} ${selectedSemester.hijri}` : '…')

  return (
    <SemesterContext.Provider value={{
      semesters, loading, selected, setSelected,
      mustChoose, confirmChoice, selectedSemester, label,
    }}>
      {children}
    </SemesterContext.Provider>
  )
}
