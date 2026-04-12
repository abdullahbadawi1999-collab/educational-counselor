import jsPDF from 'jspdf'
import 'jspdf-autotable'

export function generateStudentPDF(reportData) {
  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const { students, scope, circle, generated_at } = reportData
    const dateStr = new Date(generated_at).toLocaleDateString('en-GB')

    // ===== TITLE PAGE =====
    doc.setFillColor(27, 107, 74)
    doc.rect(0, 0, 210, 45, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Student Behavior Report', 105, 18, { align: 'center' })
    doc.setFontSize(13)
    doc.text('Al-Maher Bil-Quran - Educational Counselor', 105, 28, { align: 'center' })
    doc.setFontSize(10)
    doc.text('Date: ' + dateStr, 105, 37, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    let yPos = 55

    if (circle) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Circle: ' + circle.name + '  |  Teacher: ' + circle.teacher_name, 105, yPos, { align: 'center' })
      yPos += 10
    }

    if (scope === 'all' || scope === 'circle') {
      doc.setFontSize(10)
      doc.text('Total Students: ' + students.length, 105, yPos, { align: 'center' })
      yPos += 8
    }

    // ===== EACH STUDENT =====
    for (let si = 0; si < students.length; si++) {
      const student = students[si]

      if (yPos > 240 || si > 0) {
        doc.addPage()
        yPos = 15
      }

      // Student name banner
      doc.setFillColor(27, 107, 74)
      doc.rect(10, yPos, 190, 9, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(student.name, 105, yPos + 6.5, { align: 'center' })
      doc.setTextColor(0, 0, 0)
      yPos += 13

      // Student info
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Circle: ' + (student.circle_name || '-') + '  |  Teacher: ' + (student.teacher_name || '-'), 15, yPos)
      yPos += 5
      const phones = []
      if (student.student_phone) phones.push('Student: ' + student.student_phone)
      if (student.parent_phone_1) phones.push('Parent1: ' + student.parent_phone_1)
      if (student.parent_phone_2) phones.push('Parent2: ' + student.parent_phone_2)
      if (phones.length) {
        doc.text(phones.join('  |  '), 15, yPos)
        yPos += 5
      }

      // Summary line
      const posCount = (student.behaviors || []).filter(b => b.type === 'positive').length
      const negCount = (student.behaviors || []).filter(b => b.type === 'negative').length
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(46, 125, 50)
      doc.text('Positive: ' + posCount, 15, yPos)
      doc.setTextColor(211, 47, 47)
      doc.text('Negative: ' + negCount, 50, yPos)
      doc.setTextColor(0, 0, 0)
      doc.text('Alerts: ' + (student.alerts || []).length, 90, yPos)
      yPos += 6

      // ===== BEHAVIORS TABLE with actions =====
      if (student.behaviors && student.behaviors.length > 0) {
        const tableRows = []
        for (const b of student.behaviors) {
          const actionsText = (b.actions && b.actions.length > 0)
            ? b.actions.map(a => a.description + ' (' + a.action_date + ')').join('\n')
            : 'No action yet'

          tableRows.push([
            b.date || '-',
            b.type === 'positive' ? '+' : '-',
            b.behavior_type_name || '-',
            b.description || '-',
            actionsText
          ])
        }

        doc.autoTable({
          startY: yPos,
          head: [['Date', 'Type', 'Category', 'Description', 'Actions Taken']],
          body: tableRows,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', font: 'helvetica' },
          headStyles: { fillColor: [55, 71, 79], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 32 },
            3: { cellWidth: 55 },
            4: { cellWidth: 53 }
          },
          margin: { left: 15, right: 15 },
          didParseCell: function(data) {
            if (data.column.index === 1 && data.section === 'body') {
              data.cell.styles.textColor = data.cell.raw === '+' ? [46, 125, 50] : [211, 47, 47]
              data.cell.styles.fontStyle = 'bold'
              data.cell.styles.fontSize = 10
            }
            if (data.column.index === 4 && data.section === 'body') {
              data.cell.styles.textColor = data.cell.raw === 'No action yet' ? [200, 100, 0] : [30, 100, 50]
              data.cell.styles.fontSize = 7
            }
          }
        })

        yPos = doc.lastAutoTable.finalY + 5
      } else {
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text('No behaviors recorded for this student.', 105, yPos, { align: 'center' })
        doc.setTextColor(0, 0, 0)
        yPos += 6
      }

      // ===== ALERTS TABLE =====
      if (student.alerts && student.alerts.length > 0) {
        if (yPos > 250) { doc.addPage(); yPos = 15 }

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('Alerts & Warnings:', 15, yPos)
        yPos += 3

        const alertRows = student.alerts.map(a => [
          a.level_name || '-',
          a.reason || '-',
          a.status === 'pending' ? 'Pending' : 'Done',
          a.action_taken || '-'
        ])

        doc.autoTable({
          startY: yPos,
          head: [['Level', 'Reason', 'Status', 'Action Taken']],
          body: alertRows,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
          headStyles: { fillColor: [245, 124, 0], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 75 },
            2: { cellWidth: 18 },
            3: { cellWidth: 57 }
          },
          margin: { left: 15, right: 15 },
          didParseCell: function(data) {
            if (data.column.index === 2 && data.section === 'body') {
              data.cell.styles.textColor = data.cell.raw === 'Pending' ? [245, 124, 0] : [46, 125, 50]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        })

        yPos = doc.lastAutoTable.finalY + 5
      }
    }

    // ===== FOOTER on last page =====
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('Al-Maher Bil-Quran - Educational Counselor Report - Page ' + i + '/' + pageCount, 105, 290, { align: 'center' })
    }

    // Save
    const fileName = scope === 'student' && students[0]
      ? 'report_student.pdf'
      : scope === 'circle' && circle
      ? 'report_circle.pdf'
      : 'report_all.pdf'

    doc.save(fileName)
  } catch (err) {
    console.error('PDF generation error:', err)
    throw err
  }
}
