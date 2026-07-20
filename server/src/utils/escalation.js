/**
 * Escalation engine — semester-scoped.
 *
 * Single source of truth for turning a student's violations into alerts.
 * Every mutation path (create / edit / delete a behavior, or an explicit
 * recalculate) funnels through `recalcStudentSemester`, which wipes the
 * student's AUTO alerts for one semester and replays them deterministically
 * from that semester's behaviors. Manual alerts are preserved.
 *
 * Levels: 1 = تنبيه, 2 = إنذار, 3 = قرار.
 *
 * Absence group: the "غياب" type carries `absence_group:true` and the tardy
 * type carries `feeds_absence:true` + `converts_to_absence_at:N`. Effective
 * absences = count(غياب) + floor(count(تأخير) / N), and the 4-stage absence
 * rule is evaluated against that effective count. Older (semester-2) absence
 * types have no markers, so they fall through the normal per-type path and
 * keep their original behaviour.
 */

const LEVEL_NAMES = { 1: 'تنبيه', 2: 'إنذار', 3: 'قرار' };

function parseRule(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

// Decide the alert (if any) for a normal per-type violation whose running
// count just became `count`. Count increments by exactly 1 per event.
function normalAlertFor(count, rule) {
  if (!rule) return null;
  if (rule.immediate_warning) {
    const level = rule.immediate_warning;
    return { level, level_name: LEVEL_NAMES[level], kind: 'immediate' };
  }
  if (rule.decision_at && count >= rule.decision_at) return { level: 3, level_name: 'قرار' };
  if (rule.warning_at && count === rule.warning_at) return { level: 2, level_name: 'إنذار' };
  if (rule.alert_at && count === rule.alert_at) return { level: 1, level_name: 'تنبيه' };
  return null;
}

// Decide the alert for the absence group given the effective-absence count
// before and after this event. Fires only when the effective count actually
// advanced onto a threshold (so an odd tardy that doesn't complete a pair, or
// a repeat at the same effective count, never re-fires).
function absenceAlertFor(effBefore, effAfter, rule) {
  if (!rule || effAfter <= effBefore) return null;
  if (rule.decision_at && effAfter >= rule.decision_at) return { level: 3, level_name: 'قرار' };
  if (rule.warning_at && effAfter === rule.warning_at) return { level: 2, level_name: 'إنذار' };
  if (rule.alert_at && effAfter === rule.alert_at) return { level: 1, level_name: 'تنبيه' };
  return null;
}

// Find the active absence-group configuration (used to evaluate tardy events,
// whose own rule doesn't hold the absence thresholds).
async function resolveAbsenceGroup(sql) {
  const rows = await sql`SELECT id, name, escalation_rule FROM behavior_types WHERE is_active = 1`;
  let absenceRule = null, convertN = 2;
  for (const r of rows) {
    const rule = parseRule(r.escalation_rule);
    if (!rule) continue;
    if (rule.absence_group) absenceRule = rule;
    if (rule.feeds_absence && rule.converts_to_absence_at) convertN = rule.converts_to_absence_at;
  }
  return { absenceRule, convertN };
}

/**
 * Wipe + replay AUTO alerts for one student in one semester.
 * Returns the number of alerts regenerated.
 */
async function recalcStudentSemester(sql, studentId, semesterId) {
  if (!semesterId) return 0;

  // 1) Remove this student's auto alerts for the semester (keep manual ones).
  await sql`DELETE FROM alerts WHERE student_id = ${studentId} AND semester_id = ${semesterId} AND trigger_type = 'auto'`;

  // 2) Ordered violations for the semester, with their type rules.
  const behaviors = await sql`SELECT b.id, b.behavior_type_id, bt.name AS bt_name, bt.escalation_rule
    FROM behaviors b
    JOIN behavior_types bt ON b.behavior_type_id = bt.id
    WHERE b.student_id = ${studentId} AND b.semester_id = ${semesterId}
      AND b.type = 'negative' AND b.behavior_type_id IS NOT NULL
    ORDER BY b.created_at ASC, b.id ASC`;

  const { absenceRule, convertN } = await resolveAbsenceGroup(sql);

  const counts = {};       // behavior_type_id -> running count (normal types)
  let absenceCount = 0;    // running count of absence-group absences
  let tardyCount = 0;      // running count of absence-group tardies
  let regenerated = 0;

  for (const b of behaviors) {
    const rule = parseRule(b.escalation_rule);
    if (!rule) continue;

    let alert = null;
    let reason = '';

    if (rule.absence_group || rule.feeds_absence) {
      const effBefore = absenceCount + Math.floor(tardyCount / convertN);
      if (rule.absence_group) absenceCount++; else tardyCount++;
      const effAfter = absenceCount + Math.floor(tardyCount / convertN);
      alert = absenceAlertFor(effBefore, effAfter, absenceRule || rule);
      if (alert) reason = `الغياب (شامل التأخير) — بلغ ${effAfter} — ${alertPhrase(alert.level)}`;
    } else {
      counts[b.behavior_type_id] = (counts[b.behavior_type_id] || 0) + 1;
      const count = counts[b.behavior_type_id];
      alert = normalAlertFor(count, rule);
      if (alert) {
        reason = alert.kind === 'immediate'
          ? `${b.bt_name} — إنذار فوري حسب الميثاق`
          : `${b.bt_name} — تكررت ${count} ${count <= 2 ? 'مرة' : 'مرات'} — ${alertPhrase(alert.level)}`;
      }
    }

    if (alert) {
      await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type, semester_id)
        VALUES (${studentId}, ${alert.level}, ${alert.level_name}, ${reason}, ${String(b.id)}, 'auto', ${semesterId})`;
      regenerated++;
    }
  }

  // 3) Re-apply existing actions as "done" on matching alerts of this semester.
  const actions = await sql`SELECT a.description, a.action_date, b.id AS bid
    FROM actions a JOIN behaviors b ON a.behavior_id = b.id
    WHERE b.student_id = ${studentId} AND b.semester_id = ${semesterId}`;
  for (const a of actions) {
    const bid = String(a.bid);
    await sql`UPDATE alerts
      SET status = 'done',
          action_taken = COALESCE(action_taken, ${a.description}),
          action_date = COALESCE(action_date, ${a.action_date})
      WHERE status = 'pending' AND semester_id = ${semesterId} AND student_id = ${studentId}
        AND (trigger_behavior_ids = ${bid}
          OR trigger_behavior_ids LIKE ${bid + ',%'}
          OR trigger_behavior_ids LIKE ${'%,' + bid}
          OR trigger_behavior_ids LIKE ${'%,' + bid + ',%'})`;
  }

  return regenerated;
}

function alertPhrase(level) {
  if (level === 3) return 'يُحال للمشرفين لاتخاذ القرار';
  if (level === 2) return 'إنذار رسمي حسب الميثاق';
  return 'تواصل مع ولي الأمر';
}

// After a recalc, return the alert (if any) that this specific behavior triggered.
async function alertForBehavior(sql, behaviorId, semesterId) {
  const bid = String(behaviorId);
  const rows = await sql`SELECT level, level_name, reason FROM alerts
    WHERE semester_id = ${semesterId} AND trigger_type = 'auto'
      AND (trigger_behavior_ids = ${bid}
        OR trigger_behavior_ids LIKE ${bid + ',%'}
        OR trigger_behavior_ids LIKE ${'%,' + bid}
        OR trigger_behavior_ids LIKE ${'%,' + bid + ',%'})
    ORDER BY level DESC LIMIT 1`;
  return rows.length ? rows[0] : null;
}

module.exports = {
  LEVEL_NAMES,
  parseRule,
  normalAlertFor,
  absenceAlertFor,
  resolveAbsenceGroup,
  recalcStudentSemester,
  alertForBehavior,
};
