import html2pdf from 'html2pdf.js'
import { formatArabicDate } from '../utils/dateFormat'

/**
 * Generate a behavior-record PDF for one/many students.
 * Columns: student | violation | violation date | action taken | action date.
 * Uses html2pdf (html2canvas + jsPDF) to render Arabic text correctly via the
 * browser's font engine.
 */
export function generateStudentPDF(reportData) {
  const { students, scope, circle, generated_at } = reportData
  const dateStr = formatArabicDate(generated_at)

  const fileName = scope === 'student' && students[0]
    ? `تقرير_${students[0].name.replace(/\s+/g, '_').substring(0, 30)}.pdf`
    : scope === 'circle' && circle
    ? `تقرير_حلقة_${circle.name.replace(/\s+/g, '_')}.pdf`
    : 'تقرير_جميع_الطلاب.pdf'

  // Build rows
  const rowsHtml = []
  for (const s of students) {
    const violations = (s.behaviors || []).filter(b => b.type === 'negative')
    if (violations.length === 0) {
      rowsHtml.push(rowHtml(s.name, s.circle_name, s.teacher_name, 'لا توجد مخالفات', '', '', ''))
      continue
    }
    for (const b of violations) {
      const vDate = formatArabicDate(b.date)
      const vName = escapeHtml(b.behavior_type_name || b.description || '-')
      const actions = b.actions || []
      if (actions.length === 0) {
        rowsHtml.push(rowHtml(s.name, s.circle_name, s.teacher_name, vName, vDate, 'لم يتم اتخاذ إجراء', ''))
      } else {
        for (const a of actions) {
          rowsHtml.push(rowHtml(s.name, s.circle_name, s.teacher_name, vName, vDate, escapeHtml(a.description), formatArabicDate(a.action_date)))
        }
      }
    }
  }

  const html = `
  <div id="pdf-report" dir="rtl" lang="ar" style="
    font-family: 'Tajawal', 'Cairo', 'Amiri', Arial, sans-serif;
    padding: 24px;
    color: #1a1a2e;
    font-size: 12px;
    line-height: 1.6;
    background: white;
    width: 780px;
  ">
    <div style="text-align:center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1B6B4A;">
      <div style="font-size: 22px; font-weight: 800; color: #1B6B4A; margin-bottom: 4px;">تقرير السجل السلوكي</div>
      <div style="font-size: 13px; color: #555;">الماهر بالقرآن — الموجه التربوي</div>
      <div style="font-size: 11px; color: #777; margin-top: 4px;">تاريخ التقرير: ${escapeHtml(dateStr)}</div>
      ${circle ? `<div style="font-size: 12px; color: #1B6B4A; margin-top: 6px; font-weight: 600;">الحلقة: ${escapeHtml(circle.name)} — المعلم: ${escapeHtml(circle.teacher_name)}</div>` : ''}
    </div>

    <table style="width:100%; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #1B6B4A; color: white;">
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">الطالب</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">الحلقة</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">المعلم</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">المخالفة</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">تاريخ المخالفة</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">الإجراء المتخذ</th>
          <th style="padding: 8px 6px; border: 1px solid #145236; text-align: center; font-weight: 700;">تاريخ الإجراء</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml.join('\n')}
      </tbody>
    </table>

    <div style="margin-top: 16px; text-align: center; font-size: 10px; color: #999;">
      الماهر بالقرآن — الموجه التربوي — ${escapeHtml(dateStr)}
    </div>
  </div>`

  // Create offscreen container
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.innerHTML = html
  document.body.appendChild(container)

  const element = container.querySelector('#pdf-report')

  const opts = {
    margin: [10, 10, 10, 10],
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  }

  return html2pdf().set(opts).from(element).save().finally(() => {
    document.body.removeChild(container)
  })
}

function rowHtml(student, circle, teacher, violation, vDate, action, aDate) {
  const actionBg = action === 'لم يتم اتخاذ إجراء'
    ? '#FFF3E0'
    : action === 'لا توجد مخالفات'
    ? '#F5F5F5'
    : '#E8F5E9'
  return `
    <tr style="background: white;">
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center; font-weight: 600;">${escapeHtml(student)}</td>
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center;">${escapeHtml(circle || '-')}</td>
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center;">${escapeHtml(teacher || '-')}</td>
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center;">${violation}</td>
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center; white-space: nowrap;">${escapeHtml(vDate || '-')}</td>
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center; background: ${actionBg};">${action}</td>
      <td style="padding: 6px 8px; border: 1px solid #D4D4D4; text-align: center; white-space: nowrap;">${escapeHtml(aDate || '-')}</td>
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
