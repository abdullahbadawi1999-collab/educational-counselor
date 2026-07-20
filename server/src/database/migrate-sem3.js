/**
 * Migration: Third semester (الفصل الدراسي الثالث ١٤٤٨هـ) rollout.
 *
 * Idempotent. Run once with:  node src/database/migrate-sem3.js
 *
 * Does:
 *   1. Create `semesters` table + seed Sem2 (1447) and Sem3 (1448, current).
 *   2. Add `semester_id` to behaviors + alerts, backfill existing rows -> Sem2.
 *   3. Deactivate old absence/tardy/neglect behavior types, insert 3 new Sem3
 *      types with escalation markers.
 *   4. Import the third-semester roster from the Excel sheet: add new students,
 *      move students whose circle changed, exclude (is_active=0) students no
 *      longer on the roster.
 */
const path = require('path');
const { sql } = require('./connection');
const XLSX = require(path.join(__dirname, '../../../client/node_modules/xlsx'));

const EXCEL_PATH = 'C:/Users/user/Desktop/بيانات الطلاب - Copy.xlsx';

// Arabic normalization for name/circle matching.
const norm = (s) => (s || '')
  .toString()
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ـ/g, '');

async function ensureSemesters() {
  await sql`CREATE TABLE IF NOT EXISTS semesters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    hijri TEXT,
    gregorian TEXT,
    start_date TEXT,
    end_date TEXT,
    is_current INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  const rows = await sql`SELECT id, name, is_current FROM semesters ORDER BY sort_order`;
  const byName = {};
  rows.forEach(r => { byName[r.name] = r; });

  const S2 = 'الفصل الدراسي الثاني';
  const S3 = 'الفصل الدراسي الثالث';

  if (!byName[S2]) {
    await sql`INSERT INTO semesters (name, hijri, gregorian, start_date, end_date, is_current, sort_order)
      VALUES (${S2}, '١٤٤٧هـ', '٢٠٢٦م', '2026-01-01', '2026-07-10', 0, 2)`;
  }
  if (!byName[S3]) {
    await sql`INSERT INTO semesters (name, hijri, gregorian, start_date, end_date, is_current, sort_order)
      VALUES (${S3}, '١٤٤٨هـ', '٢٠٢٦م', '2026-07-11', NULL, 1, 3)`;
  }
  // Make sure exactly Sem3 is current.
  await sql`UPDATE semesters SET is_current = 0 WHERE name <> ${S3}`;
  await sql`UPDATE semesters SET is_current = 1 WHERE name = ${S3}`;

  const all = await sql`SELECT id, name FROM semesters`;
  const map = {};
  all.forEach(r => { map[r.name] = r.id; });
  return { sem2Id: map[S2], sem3Id: map[S3] };
}

async function ensureSemesterColumns(sem2Id) {
  await sql`ALTER TABLE behaviors ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id)`;
  await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id)`;
  const b = await sql`UPDATE behaviors SET semester_id = ${sem2Id} WHERE semester_id IS NULL`;
  const a = await sql`UPDATE alerts SET semester_id = ${sem2Id} WHERE semester_id IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_behaviors_semester ON behaviors(semester_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alerts_semester ON alerts(semester_id)`;
  console.log(`  backfilled behaviors: ${b.length ?? 0}, alerts: ${a.length ?? 0} (rows already set stay untouched)`);
}

async function ensureBehaviorTypes() {
  // Deactivate the semester-2 variants whose rules changed for semester 3.
  const deactivateNames = [
    'غياب بدون عذر',
    'غياب بعذر',
    'تأخر عن الحلقة',
    'الإهمال المتكرر في الحفظ والمراجعة',
  ];
  for (const n of deactivateNames) {
    await sql`UPDATE behavior_types SET is_active = 0 WHERE name = ${n}`;
  }

  // New semester-3 types (insert only if an active one doesn't already exist).
  const newTypes = [
    { name: 'غياب', type: 'negative', category: 'attendance', severity: 'high',
      rule: { alert_at: 2, warning_at: 3, decision_at: 4, absence_group: true } },
    { name: 'تأخر عن الحلقة', type: 'negative', category: 'attendance', severity: 'low',
      rule: { converts_to_absence_at: 2, feeds_absence: true } },
    { name: 'الإهمال المتكرر في الحفظ والمراجعة', type: 'negative', category: 'academic', severity: 'medium',
      rule: { alert_at: 2, warning_at: 3, decision_at: 4 } },
  ];
  for (const t of newTypes) {
    const existing = await sql`SELECT id FROM behavior_types WHERE name = ${t.name} AND is_active = 1`;
    if (existing.length) {
      // Keep its rule in sync with the intended semester-3 rule.
      await sql`UPDATE behavior_types SET category = ${t.category}, severity = ${t.severity}, escalation_rule = ${JSON.stringify(t.rule)} WHERE id = ${existing[0].id}`;
      continue;
    }
    await sql`INSERT INTO behavior_types (name, type, category, severity, escalation_rule, is_active)
      VALUES (${t.name}, ${t.type}, ${t.category}, ${t.severity}, ${JSON.stringify(t.rule)}, 1)`;
  }
}

function readRoster() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const roster = [];
  for (const sheet of wb.SheetNames) {
    const gender = sheet === 'بنين' ? 'male' : (sheet === 'بنات' ? 'female' : null);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
    for (const r of rows.slice(1)) {
      const name = ('' + r[2]).trim();
      if (!name) continue;
      const clean = (v) => { const s = ('' + v).trim(); return (s && s !== '—') ? s : null; };
      roster.push({
        code: clean(r[1]),
        name,
        circle: ('' + r[3]).trim(),
        student_phone: clean(r[5]),
        parent_phone_1: clean(r[7]),
        parent_phone_2: gender === 'male' ? clean(r[9]) : null,
        gender,
      });
    }
  }
  return roster;
}

async function importRoster() {
  // Defensive: these columns exist on the live DB already but may be missing on a
  // fresh install seeded from an older schema.
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS code TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`;

  const roster = readRoster();

  const dbCircles = await sql`SELECT id, name FROM circles`;
  const circleByNorm = {};
  dbCircles.forEach(c => { circleByNorm[norm(c.name)] = c.id; });

  const dbStudents = await sql`SELECT id, name, circle_id, is_active, gender FROM students`;
  const dbByName = {};
  dbStudents.forEach(s => { (dbByName[norm(s.name)] = dbByName[norm(s.name)] || []).push(s); });

  const summary = { matched: 0, inserted: 0, moved: 0, excluded: 0, reactivated: 0, missingCircle: [] };
  const rosterNorms = new Set();

  for (const r of roster) {
    rosterNorms.add(norm(r.name));
    const circleId = circleByNorm[norm(r.circle)];
    if (!circleId) { summary.missingCircle.push(r.name + ' -> ' + r.circle); continue; }

    const match = dbByName[norm(r.name)];
    if (match && match.length) {
      const st = match[0];
      const moved = st.circle_id !== circleId;
      if (moved) summary.moved++;
      if (st.is_active === 0) summary.reactivated++;
      await sql`UPDATE students SET
        circle_id = ${circleId},
        is_active = 1,
        code = COALESCE(${r.code}, code),
        gender = COALESCE(${r.gender}, gender),
        student_phone = COALESCE(student_phone, ${r.student_phone}),
        parent_phone_1 = COALESCE(parent_phone_1, ${r.parent_phone_1}),
        parent_phone_2 = COALESCE(parent_phone_2, ${r.parent_phone_2})
        WHERE id = ${st.id}`;
      summary.matched++;
    } else {
      await sql`INSERT INTO students (name, circle_id, student_phone, parent_phone_1, parent_phone_2, code, gender, is_active)
        VALUES (${r.name}, ${circleId}, ${r.student_phone}, ${r.parent_phone_1}, ${r.parent_phone_2}, ${r.code}, ${r.gender}, 1)`;
      summary.inserted++;
    }
  }

  // Exclude students that are in the DB but not on the new roster.
  for (const s of dbStudents) {
    if (!rosterNorms.has(norm(s.name)) && s.is_active !== 0) {
      await sql`UPDATE students SET is_active = 0 WHERE id = ${s.id}`;
      summary.excluded++;
    }
  }

  return summary;
}

async function main() {
  console.log('== Semester 3 migration ==');

  console.log('1) semesters table...');
  const { sem2Id, sem3Id } = await ensureSemesters();
  console.log(`   Sem2 id=${sem2Id}, Sem3 id=${sem3Id} (current)`);

  console.log('2) semester_id columns + backfill...');
  await ensureSemesterColumns(sem2Id);

  console.log('3) behavior types...');
  await ensureBehaviorTypes();
  const activeTypes = await sql`SELECT name, escalation_rule FROM behavior_types WHERE is_active = 1 ORDER BY category, name`;
  console.log(`   active types (${activeTypes.length}): ` + activeTypes.map(t => t.name).join(' | '));

  console.log('4) roster import...');
  const summary = await importRoster();
  console.log('   ' + JSON.stringify(summary));

  // Final counts
  const [students, active, excluded, behSem, alertSem] = await Promise.all([
    sql`SELECT COUNT(*)::int c FROM students`,
    sql`SELECT COUNT(*)::int c FROM students WHERE is_active = 1`,
    sql`SELECT COUNT(*)::int c FROM students WHERE is_active = 0`,
    sql`SELECT semester_id, COUNT(*)::int c FROM behaviors GROUP BY semester_id`,
    sql`SELECT semester_id, COUNT(*)::int c FROM alerts GROUP BY semester_id`,
  ]);
  console.log('== Done ==');
  console.log(`students total=${students[0].c} active=${active[0].c} excluded=${excluded[0].c}`);
  console.log('behaviors by semester:', JSON.stringify(behSem));
  console.log('alerts by semester:', JSON.stringify(alertSem));
}

main().catch(err => { console.error('MIGRATION ERROR:', err); process.exit(1); });
