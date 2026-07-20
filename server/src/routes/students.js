const express = require('express');
const router = express.Router();
const { parseSemester } = require('../utils/semester');

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    const { circle_id, search, active, page = 1, limit = 100 } = req.query;
    const semId = parseSemester(req.query);
    const offset = (parseInt(page) - 1) * parseInt(limit);
    // active: '1' (default, active only) | '0' (excluded) | 'all'
    const activeVal = active === 'all' ? null : (active === undefined ? 1 : parseInt(active));
    const circleId = circle_id ? parseInt(circle_id) : null;
    const searchLike = search ? '%' + search + '%' : null;
    try {
      const students = await sql`
        SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.notes, s.circle_id, s.is_active, s.code, s.gender,
          c.name as circle_name, c.teacher_name,
          (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId})) as negative_count,
          (SELECT COUNT(*)::int FROM alerts a WHERE a.student_id = s.id AND a.status = 'pending' AND (${semId}::int IS NULL OR a.semester_id = ${semId})) as pending_alerts,
          (SELECT STRING_AGG(DISTINCT COALESCE(bt.name, b.description), '، ') FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = s.id AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId}) AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.behavior_id = b.id)) as pending_violations
        FROM students s LEFT JOIN circles c ON s.circle_id = c.id
        WHERE (${activeVal}::int IS NULL OR s.is_active = ${activeVal})
          AND (${circleId}::int IS NULL OR s.circle_id = ${circleId})
          AND (${searchLike}::text IS NULL OR s.name LIKE ${searchLike})
        ORDER BY s.name LIMIT ${parseInt(limit)} OFFSET ${offset}`;

      const countResult = await sql`SELECT COUNT(*)::int as total FROM students s
        WHERE (${activeVal}::int IS NULL OR s.is_active = ${activeVal})
          AND (${circleId}::int IS NULL OR s.circle_id = ${circleId})
          AND (${searchLike}::text IS NULL OR s.name LIKE ${searchLike})`;
      res.json({ students, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Count of excluded students (for the sidebar badge).
  router.get('/excluded-count', async (req, res) => {
    try {
      const rows = await sql`SELECT COUNT(*)::int as count FROM students WHERE is_active = 0`;
      res.json({ count: rows[0].count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/:id', async (req, res) => {
    try {
      const rows = await sql`SELECT s.*, c.name as circle_name, c.teacher_name FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.id = ${req.params.id}`;
      if (!rows.length) return res.status(404).json({ error: 'الطالب غير موجود' });
      res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/:id/behaviors', async (req, res) => {
    const semId = parseSemester(req.query);
    try {
      const behaviors = await sql`
        SELECT b.id, b.type, b.description, b.date, b.created_at, b.semester_id, bt.name as behavior_type_name
        FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id
        WHERE b.student_id = ${req.params.id} AND b.type = 'negative' AND (${semId}::int IS NULL OR b.semester_id = ${semId})
        ORDER BY b.date DESC, b.created_at DESC`;
      for (const b of behaviors) {
        b.actions = await sql`SELECT id, description, action_date, created_at FROM actions WHERE behavior_id = ${b.id} ORDER BY action_date DESC`;
      }
      res.json(behaviors);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { name, circle_id, student_phone, parent_phone_1, parent_phone_2, notes, gender, code } = req.body;
    if (!name || !circle_id) return res.status(400).json({ error: 'اسم الطالب والحلقة مطلوبان' });
    try {
      const result = await sql`INSERT INTO students (name, circle_id, student_phone, parent_phone_1, parent_phone_2, notes, gender, code, is_active) VALUES (${name}, ${circle_id}, ${student_phone || null}, ${parent_phone_1 || null}, ${parent_phone_2 || null}, ${notes || null}, ${gender || null}, ${code || null}, 1) RETURNING id`;
      res.status(201).json({ id: result[0].id, name, circle_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { name, circle_id, student_phone, parent_phone_1, parent_phone_2, notes, gender, code } = req.body;
    try {
      await sql`UPDATE students SET name = COALESCE(${name}, name), circle_id = COALESCE(${circle_id}, circle_id), student_phone = ${student_phone || null}, parent_phone_1 = ${parent_phone_1 || null}, parent_phone_2 = ${parent_phone_2 || null}, notes = ${notes || null}, gender = COALESCE(${gender}, gender), code = COALESCE(${code}, code) WHERE id = ${req.params.id}`;
      res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Exclude a student (soft) — moves them to the excluded list, keeps all history.
  router.post('/:id/exclude', async (req, res) => {
    try {
      await sql`UPDATE students SET is_active = 0 WHERE id = ${req.params.id}`;
      res.json({ message: 'تم استبعاد الطالب' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Restore an excluded student, optionally into a chosen circle.
  router.post('/:id/restore', async (req, res) => {
    const { circle_id } = req.body;
    try {
      await sql`UPDATE students SET is_active = 1, circle_id = COALESCE(${circle_id || null}, circle_id) WHERE id = ${req.params.id}`;
      res.json({ message: 'تم إرجاع الطالب' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Deletion is now a soft exclude (kept for backward compatibility).
  router.delete('/:id', async (req, res) => {
    try {
      await sql`UPDATE students SET is_active = 0 WHERE id = ${req.params.id}`;
      res.json({ message: 'تم استبعاد الطالب' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
