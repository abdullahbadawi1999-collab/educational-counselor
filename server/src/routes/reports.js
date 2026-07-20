const express = require('express');
const router = express.Router();
const { parseSemester } = require('../utils/semester');

module.exports = function(sql) {
  router.get('/data', async (req, res) => {
    const { scope = 'all', circle_id, student_id } = req.query;
    const semId = parseSemester(req.query);
    try {
      let studentsData = [];
      if (scope === 'student' && student_id) {
        const rows = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.is_active, c.name as circle_name, c.teacher_name FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.id = ${student_id}`;
        if (rows.length) {
          rows[0].behaviors = await getBehaviors(sql, rows[0].id, semId);
          rows[0].alerts = await getAlerts(sql, rows[0].id, semId);
          studentsData = rows;
        }
      } else if (scope === 'circle' && circle_id) {
        // Active students of the circle, plus excluded ones that have data in the viewed semester.
        studentsData = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.is_active, c.name as circle_name, c.teacher_name
          FROM students s JOIN circles c ON s.circle_id = c.id
          WHERE s.circle_id = ${circle_id}
            AND (s.is_active = 1 OR EXISTS (SELECT 1 FROM behaviors b WHERE b.student_id = s.id AND (${semId}::int IS NULL OR b.semester_id = ${semId})))
          ORDER BY s.name`;
        for (const s of studentsData) { s.behaviors = await getBehaviors(sql, s.id, semId); s.alerts = await getAlerts(sql, s.id, semId); }
      } else {
        studentsData = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.is_active, c.name as circle_name, c.teacher_name
          FROM students s JOIN circles c ON s.circle_id = c.id
          WHERE (s.is_active = 1 OR EXISTS (SELECT 1 FROM behaviors b WHERE b.student_id = s.id AND (${semId}::int IS NULL OR b.semester_id = ${semId})))
          ORDER BY c.name, s.name`;
        for (const s of studentsData) { s.behaviors = await getBehaviors(sql, s.id, semId); s.alerts = await getAlerts(sql, s.id, semId); }
      }

      let circleInfo = null;
      if (scope === 'circle' && circle_id) {
        const c = await sql`SELECT name, teacher_name FROM circles WHERE id = ${circle_id}`;
        if (c.length) circleInfo = c[0];
      }

      let semesterInfo = null;
      if (semId) {
        const sm = await sql`SELECT name, hijri, gregorian FROM semesters WHERE id = ${semId}`;
        if (sm.length) semesterInfo = sm[0];
      }

      res.json({ scope, circle: circleInfo, semester: semesterInfo, generated_at: new Date().toISOString(), students: studentsData });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  async function getBehaviors(sql, studentId, semId) {
    const rows = await sql`SELECT b.id, b.type, b.description, b.date, bt.name as behavior_type_name FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = ${studentId} AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId}) ORDER BY b.date DESC`;
    for (const b of rows) {
      b.actions = await sql`SELECT description, action_date FROM actions WHERE behavior_id = ${b.id} ORDER BY action_date`;
      b.action_count = b.actions.length;
    }
    return rows;
  }

  async function getAlerts(sql, studentId, semId) {
    return await sql`SELECT level, level_name, reason, status, action_taken, action_date FROM alerts WHERE student_id = ${studentId} AND (${semId}::int IS NULL OR semester_id = ${semId}) ORDER BY created_at DESC`;
  }

  router.get('/ai-consultation/:studentId', async (req, res) => {
    const semId = parseSemester(req.query);
    try {
      const s = await sql`SELECT s.name, c.name as circle_name FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.id = ${req.params.studentId}`;
      if (!s.length) return res.status(404).json({ error: 'الطالب غير موجود' });
      const behaviors = await getBehaviors(sql, req.params.studentId, semId);
      const alerts = await getAlerts(sql, req.params.studentId, semId);
      res.json({ student_name: s[0].name, circle_name: s[0].circle_name, total_behaviors: behaviors.length, negative_count: behaviors.length, alerts_summary: { total: alerts.length, pending: alerts.filter(a => a.status === 'pending').length, alerts_list: alerts }, behaviors });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
