import * as XLSX from 'xlsx'
import { formatArabicDate } from '../utils/dateFormat'

/**
 * Build flat report rows of the form:
 *   [student_name, circle, teacher, violation, violation_date, action_taken, action_date]
 * One row per (behavior, action) pair. If a behavior has no action → single row
 * with empty action fields. Only negative behaviors (violations) are included.
 */
function buildFlatRows(students) {
  const rows = []
  for (const s of students) {
    const violations = (s.behaviors || []).filter(b => b.type === 'negative')
    if (violations.length === 0) {
      // Still list the student so the report shows them
      rows.push([s.name, s.circle_name || '-', s.teacher_name || '-', 'لا توجد مخالفات', '-', '-', '-'])
      continue
    }
    for (const b of violations) {
      const vDate = formatArabicDate(b.date)
      const vName = b.behavior_type_name || b.description || '-'
      const actions = b.actions || []
      if (actions.length === 0) {
        rows.push([s.name, s.circle_name || '-', s.teacher_name || '-', vName, vDate, 'لم يتم اتخاذ إجراء', '-'])
      } else {
        for (const a of actions) {
          rows.push([s.name, s.circle_name || '-', s.teacher_name || '-', vName, vDate, a.description || '-', formatArabicDate(a.action_date)])
        }
      }
    }
  }
  return rows
}

export function generateStudentExcel(reportData) {
  const { students, scope, circle, generated_at } = reportData
  const wb = XLSX.utils.book_new()
  const dateStr = formatArabicDate(generated_at)

  const headers = ['الطالب', 'الحلقة', 'المعلم', 'المخالفة', 'تاريخ المخالفة', 'الإجراء المتخذ', 'تاريخ الإجراء']

  const topRows = [
    ['تقرير السجل السلوكي — الماهر بالقرآن'],
    ['الموجه التربوي'],
    ['تاريخ التقرير:', dateStr],
    circle ? ['الحلقة:', circle.name, 'المعلم:', circle.teacher_name] : [],
    [],
    headers
  ].filter(r => r.length > 0)

  const dataRows = buildFlatRows(students)
  const allRows = [...topRows, ...dataRows]

  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 35 }, { wch: 18 }
  ]
  ws['!rtl'] = true
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير')

  const fileName = scope === 'student' && students[0]
    ? `تقرير_${students[0].name.replace(/\s+/g, '_').substring(0, 30)}.xlsx`
    : scope === 'circle' && circle
    ? `تقرير_حلقة_${circle.name.replace(/\s+/g, '_')}.xlsx`
    : 'تقرير_جميع_الطلاب.xlsx'

  XLSX.writeFile(wb, fileName)
}

// Also export the helper so the PDF service can reuse it
export { buildFlatRows }
