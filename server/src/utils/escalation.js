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

// Given a running count and a rule, the current (highest) stage reached.
// Uses >= for every threshold so only the current stage is reported — not each
// crossing — which is what keeps one alert per type at the student's live stage.
function currentLevelFor(count, rule) {
  if (!rule || count <= 0) return 0;
  if (rule.immediate_warning) return rule.immediate_warning;
  if (rule.decision_at && count >= rule.decision_at) return 3;
  if (rule.warning_at && count >= rule.warning_at) return 2;
  if (rule.alert_at && count >= rule.alert_at) return 1;
  return 0;
}

/**
 * Wipe + rebuild AUTO alerts for one student in one semester.
 *
 * Emits AT MOST ONE alert per behaviour type (and one for the absence group),
 * at the student's CURRENT highest stage — so reaching إنذار removes the تنبيه,
 * reaching قرار removes the إنذار, and a student never appears twice for the
 * same violation. The alert is anchored to that type's latest violation, and any
 * action already taken on that violation is carried over as "done".
 *
 * Returns the number of alerts generated.
 */
async function recalcStudentSemester(sql, studentId, semesterId) {
  if (!semesterId) return 0;

  // 1) Remove this student's auto alerts for the semester (keep manual ones).
  await sql`DELETE FROM alerts WHERE student_id = ${studentId} AND semester_id = ${semesterId} AND trigger_type = 'auto'`;

  // 2) Ordered violations for the semester, with their type rules.
  const behaviors = await sql`SELECT b.id, b.behavior_type_id, b.created_at, bt.name AS bt_name, bt.escalation_rule
    FROM behaviors b
    JOIN behavior_types bt ON b.behavior_type_id = bt.id
    WHERE b.student_id = ${studentId} AND b.semester_id = ${semesterId}
      AND b.type = 'negative' AND b.behavior_type_id IS NOT NULL
    ORDER BY b.created_at ASC, b.id ASC`;

  const { absenceRule, convertN } = await resolveAbsenceGroup(sql);

  // Tally final counts + the latest violation (anchor) per type / absence group.
  const typeState = {};    // behavior_type_id -> { count, rule, name, lastId, lastAt }
  let absenceCount = 0, tardyCount = 0, lastAbsenceId = null, lastAbsenceAt = null;

  for (const b of behaviors) {
    const rule = parseRule(b.escalation_rule);
    if (!rule) continue;
    if (rule.absence_group || rule.feeds_absence) {
      if (rule.absence_group) absenceCount++; else tardyCount++;
      lastAbsenceId = b.id; lastAbsenceAt = b.created_at;
    } else {
      const st = typeState[b.behavior_type_id] || { count: 0, rule, name: b.bt_name };
      st.count++; st.rule = rule; st.name = b.bt_name; st.lastId = b.id; st.lastAt = b.created_at;
      typeState[b.behavior_type_id] = st;
    }
  }

  let regenerated = 0;
  const insertAlert = async (level, reason, triggerId, createdAt) => {
    await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type, semester_id, created_at)
      VALUES (${studentId}, ${level}, ${LEVEL_NAMES[level]}, ${reason}, ${String(triggerId)}, 'auto', ${semesterId}, ${createdAt})`;
    regenerated++;
  };

  // Normal types: one alert at the current stage.
  for (const st of Object.values(typeState)) {
    const level = currentLevelFor(st.count, st.rule);
    if (level <= 0) continue;
    const reason = st.rule.immediate_warning
      ? `${st.name} — إنذار فوري حسب الميثاق (تكرر ${st.count})`
      : `${st.name} — تكررت ${st.count} ${st.count <= 2 ? 'مرة' : 'مرات'} — ${alertPhrase(level)}`;
    await insertAlert(level, reason, st.lastId, st.lastAt);
  }

  // Absence group: one alert at the current stage, on the effective count.
  if (absenceRule && (absenceCount > 0 || tardyCount > 0)) {
    const effective = absenceCount + Math.floor(tardyCount / (convertN || 2));
    const level = currentLevelFor(effective, absenceRule);
    if (level > 0 && lastAbsenceId) {
      await insertAlert(level, `الغياب (شامل التأخير) — بلغ ${effective} — ${alertPhrase(level)}`, lastAbsenceId, lastAbsenceAt);
    }
  }

  // 3) Re-apply existing actions as "done" on the matching current-stage alert.
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
