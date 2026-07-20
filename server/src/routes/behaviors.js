const express = require('express');
const router = express.Router();
const { parseSemester, getCurrentSemesterId } = require('../utils/semester');
const { recalcStudentSemester, alertForBehavior } = require('../utils/escalation');

module.exports = function(sql) {
  router.get('/types', async (req, res) => {
    try {
      const types = await sql`SELECT id, name, type, category, severity, escalation_rule, is_active FROM behavior_types WHERE is_active = 1 AND type = 'negative' ORDER BY category, name`;
      res.json(types.map(t => ({ ...t, escalation_rule: t.escalation_rule ? JSON.parse(t.escalation_rule) : null })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/types', async (req, res) => {
    const { name, type } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'الاسم والنوع مطلوبان' });
    try {
      const result = await sql`INSERT INTO behavior_types (name, type) VALUES (${name}, ${type}) RETURNING id`;
      res.status(201).json({ id: result[0].id, name, type });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/', async (req, res) => {
    const { student_id, circle_id, limit = 50 } = req.query;
    const semId = parseSemester(req.query);
    try {
      let behaviors;
      if (student_id) {
        behaviors = await sql`SELECT b.id, b.student_id, b.type, b.description, b.date, b.created_at, b.semester_id, s.name as student_name, c.name as circle_name, c.id as circle_id, c.teacher_name, bt.name as behavior_type_name, (SELECT COUNT(*)::int FROM actions a WHERE a.behavior_id = b.id) as action_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = ${student_id} AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId}) ORDER BY b.date DESC, b.created_at DESC LIMIT ${parseInt(limit)}`;
      } else if (circle_id) {
        behaviors = await sql`SELECT b.id, b.student_id, b.type, b.description, b.date, b.created_at, b.semester_id, s.name as student_name, c.name as circle_name, c.id as circle_id, c.teacher_name, bt.name as behavior_type_name, (SELECT COUNT(*)::int FROM actions a WHERE a.behavior_id = b.id) as action_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE s.circle_id = ${circle_id} AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId}) ORDER BY b.date DESC, b.created_at DESC LIMIT ${parseInt(limit)}`;
      } else {
        behaviors = await sql`SELECT b.id, b.student_id, b.type, b.description, b.date, b.created_at, b.semester_id, s.name as student_name, c.name as circle_name, c.id as circle_id, c.teacher_name, bt.name as behavior_type_name, (SELECT COUNT(*)::int FROM actions a WHERE a.behavior_id = b.id) as action_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId}) ORDER BY b.date DESC, b.created_at DESC LIMIT ${parseInt(limit)}`;
      }
      res.json(behaviors);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/:id', async (req, res) => {
    try {
      const rows = await sql`SELECT b.*, s.name as student_name, c.name as circle_name, bt.name as behavior_type_name FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.id = ${req.params.id}`;
      if (!rows.length) return res.status(404).json({ error: 'السلوك غير موجود' });
      const behavior = rows[0];
      behavior.actions = await sql`SELECT * FROM actions WHERE behavior_id = ${req.params.id} ORDER BY action_date DESC`;
      res.json(behavior);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { student_id, behavior_type_id, description, date } = req.body;
    // Platform records only violations (negative behaviors).
    const type = 'negative';
    if (!student_id || !description || !date) return res.status(400).json({ error: 'الطالب والوصف والتاريخ مطلوبين' });
    try {
      // Writes always land in the current semester, regardless of the view.
      const semesterId = await getCurrentSemesterId(sql);
      const result = await sql`INSERT INTO behaviors (student_id, behavior_type_id, type, description, date, semester_id) VALUES (${student_id}, ${behavior_type_id || null}, ${type}, ${description}, ${date}, ${semesterId}) RETURNING id`;
      const id = result[0].id;

      let generatedAlert = null;
      if (behavior_type_id) {
        try {
          await recalcStudentSemester(sql, student_id, semesterId);
          generatedAlert = await alertForBehavior(sql, id, semesterId);
        } catch (err) { console.error('Escalation error:', err.message); }
      }
      res.status(201).json({ id, student_id, type, description, date, semester_id: semesterId, generated_alert: generatedAlert });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { type, description, date, behavior_type_id } = req.body;
    try {
      const oldRows = await sql`SELECT * FROM behaviors WHERE id = ${req.params.id}`;
      if (!oldRows.length) return res.status(404).json({ error: 'السلوك غير موجود' });
      const oldBehavior = oldRows[0];

      const newTypeId = behavior_type_id !== undefined ? (behavior_type_id || null) : oldBehavior.behavior_type_id;
      const typeChanged = (type !== undefined ? type : oldBehavior.type) !== oldBehavior.type;
      const btChanged = String(newTypeId || '') !== String(oldBehavior.behavior_type_id || '');
      const needsRecalc = typeChanged || btChanged;

      await sql`UPDATE behaviors SET
        type = COALESCE(${type}, type),
        description = COALESCE(${description}, description),
        date = COALESCE(${date}, date),
        behavior_type_id = ${newTypeId}
        WHERE id = ${req.params.id}`;

      let generatedAlert = null;
      if (needsRecalc) {
        try {
          await recalcStudentSemester(sql, oldBehavior.student_id, oldBehavior.semester_id);
          generatedAlert = await alertForBehavior(sql, req.params.id, oldBehavior.semester_id);
        } catch (err) { console.error('Escalation recalc error:', err.message); }
      }

      res.json({ message: 'تم التحديث', recalculated: needsRecalc, generated_alert: generatedAlert });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const rows = await sql`SELECT student_id, semester_id FROM behaviors WHERE id = ${req.params.id}`;
      await sql`DELETE FROM behaviors WHERE id = ${req.params.id}`;
      // Recompute the student's alerts for that semester so counts stay correct.
      if (rows.length) {
        try { await recalcStudentSemester(sql, rows[0].student_id, rows[0].semester_id); }
        catch (err) { console.error('Escalation recalc (delete) error:', err.message); }
      }
      res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
