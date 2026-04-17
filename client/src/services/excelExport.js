import * as XLSX from 'xlsx'

// Export a report as xlsx with one sheet per student, plus summary sheet
export function generateStudentExcel(reportData) {
  const { students, scope, circle, generated_at } = reportData
  const wb = XLSX.utils.book_new()
  const dateStr = new Date(generated_at).toLocaleDateString('ar-EG')

  // ===== Summary sheet =====
  const summaryRows = [
    ['تقرير السجل السلوكي للطلاب'],
    ['الماهر بالقرآن — الموجه التربوي'],
    ['التاريخ:', dateStr],
    circle ? ['الحلقة:', circle.name, 'المعلم:', circle.teacher_name] : [],
    [],
    ['الطالب', 'الحلقة', 'المعلم', 'إيجابيات', 'سلبيات', 'تنبيهات/إنذارات', 'معلقة'],
  ].filter(r => r.length > 0)

  for (const s of students) {
    const pos = (s.behaviors || []).filter(b => b.type === 'positive').length
    const neg = (s.behaviors || []).filter(b => b.type === 'negative').length
    const alerts = (s.alerts || []).length
    const pending = (s.alerts || []).filter(a => a.status === 'pending').length
    summaryRows.push([s.name, s.circle_name, s.teacher_name, pos, neg, alerts, pending])
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }
  ]
  summarySheet['!rtl'] = true
  XLSX.utils.book_append_sheet(wb, summarySheet, 'الملخص')

  // ===== Per-student sheets =====
  for (const student of students) {
    const rows = [
      [student.name],
      ['الحلقة:', student.circle_name, 'المعلم:', student.teacher_name],
      [
        'الهاتف:', student.student_phone || '-',
        'ولي الأمر 1:', student.parent_phone_1 || '-',
        'ولي الأمر 2:', student.parent_phone_2 || '-'
      ],
      [],
      ['== السلوكيات =='],
      ['التاريخ', 'النوع', 'التصنيف', 'الوصف', 'الإجراءات المتخذة', 'تاريخ الإجراء']
    ]

    for (const b of (student.behaviors || [])) {
      const actions = (b.actions || [])
      if (actions.length === 0) {
        rows.push([
          b.date || '-',
          b.type === 'positive' ? 'إيجابي' : 'سلبي',
          b.behavior_type_name || '-',
          b.description || '-',
          'لم يتم اتخاذ إجراء',
          '-'
        ])
      } else {
        // First row: behavior + first action
        rows.push([
          b.date || '-',
          b.type === 'positive' ? 'إيجابي' : 'سلبي',
          b.behavior_type_name || '-',
          b.description || '-',
          actions[0].description,
          actions[0].action_date
        ])
        // Extra actions on subsequent rows
        for (let i = 1; i < actions.length; i++) {
          rows.push(['', '', '', '', actions[i].description, actions[i].action_date])
        }
      }
    }

    if ((student.behaviors || []).length === 0) {
      rows.push(['لا توجد سلوكيات مسجلة'])
    }

    // Alerts section
    rows.push([])
    rows.push(['== التنبيهات والإنذارات =='])
    rows.push(['المستوى', 'السبب', 'الحالة', 'الإجراء المتخذ', 'تاريخ الإجراء'])

    for (const a of (student.alerts || [])) {
      rows.push([
        a.level_name || '-',
        a.reason || '-',
        a.status === 'pending' ? 'بانتظار الإجراء' : 'تم الإجراء',
        a.action_taken || '-',
        a.action_date || '-'
      ])
    }

    if ((student.alerts || []).length === 0) {
      rows.push(['لا توجد تنبيهات'])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 40 }, { wch: 40 }, { wch: 14 }
    ]
    ws['!rtl'] = true

    // Sheet name - max 31 chars, no special chars
    let sheetName = student.name.substring(0, 30).replace(/[\\\/\*\?\[\]]/g, '')
    // Ensure unique sheet names
    let counter = 1
    let finalName = sheetName
    while (wb.SheetNames.includes(finalName)) {
      finalName = sheetName.substring(0, 27) + '_' + counter
      counter++
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName)
  }

  // File name
  const fileName = scope === 'student' && students[0]
    ? `تقرير_${students[0].name.replace(/\s+/g, '_').substring(0, 30)}.xlsx`
    : scope === 'circle' && circle
    ? `تقرير_حلقة_${circle.name.replace(/\s+/g, '_')}.xlsx`
    : 'تقرير_جميع_الطلاب.xlsx'

  XLSX.writeFile(wb, fileName)
}
