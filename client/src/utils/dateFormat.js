const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/**
 * Format a date as "DayName D/M/YYYY" in Arabic.
 * Handles strings like "2026-04-18", "2026-04-18T10:30:00", "2026-04-18 10:30:00".
 * Returns empty string for falsy input; returns original string if unparseable.
 */
export function formatArabicDate(dateStr) {
  if (!dateStr) return ''
  try {
    let datePart = String(dateStr).split('T')[0]
    // Handle "YYYY-MM-DD HH:MM:SS" (SQL timestamp format)
    if (datePart.includes(' ')) datePart = datePart.split(' ')[0]
    const d = new Date(datePart + 'T00:00:00')
    if (isNaN(d.getTime())) return dateStr
    const day = ARABIC_DAYS[d.getDay()]
    return `${day} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}
