/**
 * Semester helpers shared across routes.
 *
 * Read endpoints accept a `semester` query param:
 *   - a numeric id  -> scope results to that semester
 *   - 'all' / absent -> no scoping (every semester)
 *
 * The SQL pattern used at call sites is:
 *   AND (${semId}::int IS NULL OR x.semester_id = ${semId})
 * so a null id transparently disables the filter.
 */

// Resolve the `semester` query param to an integer id or null (= all semesters).
function parseSemester(query) {
  const raw = query && query.semester;
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return null;
  const n = parseInt(raw);
  return Number.isNaN(n) ? null : n;
}

// The semester new records are written into (server-authoritative for writes).
async function getCurrentSemesterId(sql) {
  const rows = await sql`SELECT id FROM semesters WHERE is_current = 1 ORDER BY sort_order DESC LIMIT 1`;
  return rows.length ? rows[0].id : null;
}

module.exports = { parseSemester, getCurrentSemesterId };
