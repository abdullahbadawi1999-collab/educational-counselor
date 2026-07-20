const express = require('express');
const router = express.Router();
const { parseSemester, getCurrentSemesterId } = require('../utils/semester');
const { recalcStudentSemester, resolveAbsenceGroup, parseRule } = require('../utils/escalation');

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    const semId = parseSemester(req.query);
    const studentId = req.query.student_id ? parseInt(req.query.student_id) : null;
    const level = req.query.level ? parseInt(req.query.level) : null;
    const status = req.query.status || null;
    try {
      const alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name
        FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id
        WHERE (${studentId}::int IS NULL OR a.student_id = ${studentId})
          AND (${level}::int IS NULL OR a.level = ${level})
          AND (${status}::text IS NULL OR a.status = ${status})
          AND (${semId}::int IS NULL OR a.semester_id = ${semId})
        ORDER BY a.created_at DESC`;
      const pendingResult = await sql`SELECT COUNT(*)::int as count FROM alerts WHERE status = 'pending' AND (${semId}::int IS NULL OR semester_id = ${semId})`;
      res.json({ alerts, pending_count: pendingResult[0].count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/student/:studentId', async (req, res) => {
    const semId = parseSemester(req.query);
    try {
      const alerts = await sql`SELECT a.*, s.name as student_name FROM alerts a JOIN students s ON a.student_id = s.id
        WHERE a.student_id = ${req.params.studentId} AND (${semId}::int IS NULL OR a.semester_id = ${semId})
        ORDER BY a.created_at DESC`;
      res.json(alerts);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { student_id, level, level_name, reason } = req.body;
    if (!student_id || !level || !reason) return res.status(400).json({ error: 'الطالب والمستوى والسبب مطلوبين' });
    try {
      const names = { 1: 'تنبيه', 2: 'إنذار', 3: 'قرار' };
      const semesterId = await getCurrentSemesterId(sql);
      const result = await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_type, semester_id) VALUES (${student_id}, ${level}, ${level_name || names[level]}, ${reason}, 'manual', ${semesterId}) RETURNING id`;
      res.status(201).json({ id: result[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { status, action_taken, action_date } = req.body;
    try {
      const alerts = await sql`SELECT * FROM alerts WHERE id = ${req.params.id}`;
      if (!alerts.length) return res.status(404).json({ error: 'التنبيه غير موجود' });
      const alert = alerts[0];

      await sql`UPDATE alerts SET status = COALESCE(${status}, status), action_taken = COALESCE(${action_taken}, action_taken), action_date = COALESCE(${action_date}, action_date) WHERE id = ${req.params.id}`;

      // If marking as done with an action, mirror action into behavior's actions table
      if (status === 'done' && action_taken) {
        const date = action_date || new Date().toISOString().split('T')[0];
        const desc = `[${alert.level_name}] ${action_taken}`;

        let ids = [];
        if (alert.trigger_behavior_ids) {
          ids = alert.trigger_behavior_ids.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }
        if (ids.length === 0 && alert.student_id) {
          try {
            const last = await sql`SELECT id FROM behaviors WHERE student_id = ${alert.student_id} AND type = 'negative' ORDER BY created_at DESC LIMIT 1`;
            if (last.length) ids = [last[0].id];
          } catch (e) { console.error('Fallback fetch failed:', e.message); }
        }
        for (const bid of ids) {
          try {
            await sql`INSERT INTO actions (behavior_id, description, action_date) VALUES (${bid}, ${desc}, ${date})`;
          } catch (e) { console.error('Action insert failed for bid ' + bid + ':', e.message); }
        }
      }

      res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await sql`DELETE FROM alerts WHERE id = ${req.params.id}`;
      res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Recalculate a student's auto alerts. Scoped to the viewed semester, or all
  // semesters the student has behaviors in when no/`all` semester is given.
  router.post('/recalculate/:studentId', async (req, res) => {
    const studentId = parseInt(req.params.studentId);
    const semId = parseSemester(req.query);
    try {
      let semesterIds = [];
      if (semId) {
        semesterIds = [semId];
      } else {
        const rows = await sql`SELECT DISTINCT semester_id FROM behaviors WHERE student_id = ${studentId} AND semester_id IS NOT NULL`;
        semesterIds = rows.map(r => r.semester_id);
      }
      let regenerated = 0;
      for (const sid of semesterIds) regenerated += await recalcStudentSemester(sql, studentId, sid);
      res.json({ message: 'تم إعادة حساب التنبيهات', regenerated, semesters: semesterIds });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/escalation/:studentId', async (req, res) => {
    try {
      let semId = parseSemester(req.query);
      if (!semId) semId = await getCurrentSemesterId(sql);

      const behaviorCounts = await sql`SELECT bt.id as type_id, bt.name, bt.category, bt.severity, bt.escalation_rule, COUNT(b.id)::int as count
        FROM behaviors b JOIN behavior_types bt ON b.behavior_type_id = bt.id
        WHERE b.student_id = ${req.params.studentId} AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId})
        GROUP BY bt.id, bt.name, bt.category, bt.severity, bt.escalation_rule`;

      const alertCounts = await sql`SELECT level, COUNT(*)::int as count FROM alerts WHERE student_id = ${req.params.studentId} AND (${semId}::int IS NULL OR semester_id = ${semId}) GROUP BY level`;
      const ac = {};
      for (const row of alertCounts) ac[row.level] = row.count;

      const { absenceRule: activeAbsenceRule, convertN } = await resolveAbsenceGroup(sql);

      const individual = [];
      let absCount = 0, tardyCount = 0, groupSeen = false, groupRule = activeAbsenceRule;
      for (const bc of behaviorCounts) {
        const rule = parseRule(bc.escalation_rule);
        if (rule && rule.absence_group) { absCount += bc.count; groupSeen = true; groupRule = rule; continue; }
        if (rule && rule.feeds_absence) { tardyCount += bc.count; groupSeen = true; continue; }
        individual.push({ ...bc, escalation_rule: rule });
      }

      const parsed = [...individual];
      if (groupSeen && groupRule) {
        const effective = absCount + Math.floor(tardyCount / (convertN || 2));
        parsed.unshift({
          type_id: 'absence_group',
          name: 'الغياب (شامل التأخير)',
          category: 'attendance',
          severity: 'high',
          escalation_rule: groupRule,
          count: effective,
          raw_absences: absCount,
          raw_tardies: tardyCount,
        });
      }

      res.json({ behavior_counts: parsed, alert_counts: ac, semester_id: semId, pending_escalations: [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
