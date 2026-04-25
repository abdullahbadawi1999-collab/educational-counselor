import html2pdf from 'html2pdf.js'
import { formatArabicDate } from '../utils/dateFormat'

/**
 * Generate a behavior-record PDF.
 *
 * Layout depends on scope:
 *  - "student"  → student info shown ONCE at the top; table has 4 columns
 *                 (المخالفة | تاريخ المخالفة | الإجراء | تاريخ الإجراء).
 *  - "circle"   → circle/teacher shown ONCE at top; for each student a
 *                 sub-header (the student's name) is shown once and their
 *                 violations follow as 4-col rows.
 *  - "all"      → grouped by circle (with circle/teacher sub-header) and
 *                 then by student within each circle.
 *
 * Page-break handling avoids splitting individual rows but lets long tables
 * flow naturally across pages so the header is not stranded on page 1.
 */
export function generateStudentPDF(reportData) {
  const { students, scope, circle, generated_at } = reportData
  const dateStr = formatArabicDate(generated_at)

  const fileName = scope === 'student' && students[0]
    ? `تقرير_${students[0].name.replace(/\s+/g, '_').substring(0, 30)}.pdf`
    : scope === 'circle' && circle
    ? `تقرير_حلقة_${circle.name.replace(/\s+/g, '_')}.pdf`
    : 'تقرير_جميع_الطلاب.pdf'

  let bodyHtml = ''

  if (scope === 'student' && students[0]) {
    bodyHtml = renderStudentScope(students[0])
  } else if (scope === 'circle' && circle) {
    bodyHtml = renderCircleScope(students)
  } else {
    // Group by circle
    const byCircle = groupByCircle(students)
    bodyHtml = byCircle.map(g => renderCircleGroup(g.circle_name, g.teacher_name, g.students)).join('')
  }

  // Header content shown once at the very top
  const headerHtml = renderTopHeader({ scope, circle, student: scope === 'student' ? students[0] : null, dateStr })

  const html = `
  <div id="pdf-report" dir="rtl" lang="ar" style="
    font-family: 'Tajawal', 'Cairo', 'Amiri', Arial, sans-serif;
    padding: 12px 14px;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.55;
    background: white;
    width: 1060px;
    box-sizing: border-box;
  ">
    ${headerHtml}
    ${bodyHtml}
    <div style="margin-top: 10px; text-align: center; font-size: 9px; color: #999;">
      الماهر بالقرآن — الموجه التربوي — ${escapeHtml(dateStr)}
    </div>
  </div>`

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.innerHTML = html
  document.body.appendChild(container)

  const element = container.querySelector('#pdf-report')

  const opts = {
    margin: [8, 8, 8, 8],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff', windowWidth: 1080 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.no-break'] }
  }

  return html2pdf().set(opts).from(element).save().finally(() => {
    document.body.removeChild(container)
  })
}

// ===== HEADERS =====

function renderTopHeader({ scope, circle, student, dateStr }) {
  let lines = []
  lines.push(`<div style="font-size: 20px; font-weight: 800; color: #1B6B4A; margin-bottom: 2px;">تقرير السجل السلوكي</div>`)
  lines.push(`<div style="font-size: 12px; color: #555;">الماهر بالقرآن — الموجه التربوي</div>`)
  lines.push(`<div style="font-size: 10px; color: #777; margin-top: 2px;">تاريخ التقرير: ${escapeHtml(dateStr)}</div>`)

  if (scope === 'student' && student) {
    lines.push(`<div style="font-size: 14px; color: #1B6B4A; margin-top: 6px; font-weight: 700;">الطالب: ${escapeHtml(student.name)}</div>`)
    lines.push(`<div style="font-size: 11px; color: #444; margin-top: 2px;">الحلقة: ${escapeHtml(student.circle_name || '-')} — المعلم: ${escapeHtml(student.teacher_name || '-')}</div>`)
    if (student.student_phone || student.parent_phone_1 || student.parent_phone_2) {
      const phones = []
      if (student.student_phone) phones.push(`الطالب: ${student.student_phone}`)
      if (student.parent_phone_1) phones.push(`ولي الأمر: ${student.parent_phone_1}`)
      if (student.parent_phone_2) phones.push(`ولي الأمر 2: ${student.parent_phone_2}`)
      lines.push(`<div style="font-size: 10px; color: #666; margin-top: 2px;">${phones.join(' — ')}</div>`)
    }
  } else if (scope === 'circle' && circle) {
    lines.push(`<div style="font-size: 14px; color: #1B6B4A; margin-top: 6px; font-weight: 700;">حلقة: ${escapeHtml(circle.name)}</div>`)
    lines.push(`<div style="font-size: 11px; color: #444; margin-top: 2px;">المعلم: ${escapeHtml(circle.teacher_name)}</div>`)
  }

  return `
    <div class="no-break" style="text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #1B6B4A;">
      ${lines.join('')}
    </div>
  `
}

// ===== STUDENT SCOPE: 4-column table =====

function renderStudentScope(student) {
  const violations = (student.behaviors || []).filter(b => b.type === 'negative')
  if (violations.length === 0) {
    return `<div style="text-align: center; padding: 20px; color: #777; font-size: 12px;">لا توجد مخالفات مسجلة لهذا الطالب</div>`
  }

  const rows = []
  for (const b of violations) {
    const vDate = formatArabicDate(b.date)
    const vName = escapeHtml(b.behavior_type_name || b.description || '-')
    const actions = b.actions || []
    if (actions.length === 0) {
      rows.push(rowSimple(vName, vDate, 'لم يتم اتخاذ إجراء', '', true))
    } else {
      actions.forEach((a, i) => {
        rows.push(rowSimple(
          i === 0 ? vName : '',
          i === 0 ? vDate : '',
          escapeHtml(a.description),
          formatArabicDate(a.action_date),
          false
        ))
      })
    }
  }

  return `
    <table style="width:100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">
      <colgroup>
        <col style="width: 32%;" />
        <col style="width: 18%;" />
        <col style="width: 32%;" />
        <col style="width: 18%;" />
      </colgroup>
      <thead>
        <tr style="background: #1B6B4A; color: white;">
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">المخالفة</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">تاريخ المخالفة</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">الإجراء المتخذ</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">تاريخ الإجراء</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `
}

// ===== CIRCLE SCOPE: per-student sections =====

function renderCircleScope(students) {
  return students.map(s => renderStudentSection(s)).join('')
}

function renderStudentSection(student) {
  const violations = (student.behaviors || []).filter(b => b.type === 'negative')

  const rows = []
  if (violations.length === 0) {
    rows.push(`
      <tr><td colspan="4" style="padding: 8px; border: 1px solid #D4D4D4; text-align: center; color: #777; font-size: 11px;">
        لا توجد مخالفات مسجلة
      </td></tr>
    `)
  } else {
    for (const b of violations) {
      const vDate = formatArabicDate(b.date)
      const vName = escapeHtml(b.behavior_type_name || b.description || '-')
      const actions = b.actions || []
      if (actions.length === 0) {
        rows.push(rowSimple(vName, vDate, 'لم يتم اتخاذ إجراء', '', true))
      } else {
        actions.forEach((a, i) => {
          rows.push(rowSimple(
            i === 0 ? vName : '',
            i === 0 ? vDate : '',
            escapeHtml(a.description),
            formatArabicDate(a.action_date),
            false
          ))
        })
      }
    }
  }

  return `
    <div style="margin-bottom: 12px;">
      <div class="no-break" style="background: #E8F5E9; border-right: 4px solid #1B6B4A; padding: 6px 10px; margin-bottom: 0; font-weight: 700; font-size: 13px; color: #1B6B4A; border-radius: 4px 0 0 4px;">
        ${escapeHtml(student.name)}
      </div>
      <table style="width:100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; margin-top: 0;">
        <colgroup>
          <col style="width: 32%;" />
          <col style="width: 18%;" />
          <col style="width: 32%;" />
          <col style="width: 18%;" />
        </colgroup>
        <thead>
          <tr style="background: #2E7D32; color: white;">
            <th style="padding: 6px 4px; border: 1px solid #1B6B4A; text-align: center; font-weight: 700; font-size: 10.5px;">المخالفة</th>
            <th style="padding: 6px 4px; border: 1px solid #1B6B4A; text-align: center; font-weight: 700; font-size: 10.5px;">تاريخ المخالفة</th>
            <th style="padding: 6px 4px; border: 1px solid #1B6B4A; text-align: center; font-weight: 700; font-size: 10.5px;">الإجراء المتخذ</th>
            <th style="padding: 6px 4px; border: 1px solid #1B6B4A; text-align: center; font-weight: 700; font-size: 10.5px;">تاريخ الإجراء</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  `
}

// ===== ALL SCOPE: grouped by circle =====

function groupByCircle(students) {
  const map = new Map()
  for (const s of students) {
    const key = s.circle_name || '-'
    if (!map.has(key)) {
      map.set(key, { circle_name: s.circle_name, teacher_name: s.teacher_name, students: [] })
    }
    map.get(key).students.push(s)
  }
  return Array.from(map.values())
}

function renderCircleGroup(circleName, teacherName, students) {
  return `
    <div style="margin-bottom: 18px;">
      <div class="no-break" style="background: #1B6B4A; color: white; padding: 8px 12px; font-weight: 700; font-size: 14px; border-radius: 6px; margin-bottom: 6px;">
        حلقة: ${escapeHtml(circleName || '-')} — المعلم: ${escapeHtml(teacherName || '-')}
      </div>
      ${students.map(s => renderStudentSection(s)).join('')}
    </div>
  `
}

// ===== ROW HELPER (4 cols: violation | vDate | action | aDate) =====

function rowSimple(violation, vDate, action, aDate, isPending) {
  const actionBg = isPending ? '#FFF3E0' : '#E8F5E9'
  return `
    <tr>
      <td style="padding: 5px 4px; border: 1px solid #D4D4D4; text-align: center; word-wrap: break-word;">${violation}</td>
      <td style="padding: 5px 4px; border: 1px solid #D4D4D4; text-align: center; white-space: nowrap;">${escapeHtml(vDate || '')}</td>
      <td style="padding: 5px 4px; border: 1px solid #D4D4D4; text-align: center; background: ${actionBg}; word-wrap: break-word;">${action}</td>
      <td style="padding: 5px 4px; border: 1px solid #D4D4D4; text-align: center; white-space: nowrap;">${escapeHtml(aDate || '-')}</td>
    </tr>
  `
}

function escapeHtml(s) {
  if (s === undefined || s === null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
