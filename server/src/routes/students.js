const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    const { circle_id, search, page = 1, limit = 100 } = req.query;
    try {
      let students;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const selectCols = `s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.notes, s.circle_id, c.name as circle_name, c.teacher_name,
        (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'negative') as negative_count,
        (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'positive') as positive_count,
        (SELECT COUNT(*)::int FROM alerts a WHERE a.student_id = s.id AND a.status = 'pending') as pending_alerts`;
      if (circle_id && search) {
        students = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.notes, s.circle_id, c.name as circle_name, c.teacher_name, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'negative') as negative_count, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'positive') as positive_count, (SELECT COUNT(*)::int FROM alerts a WHERE a.student_id = s.id AND a.status = 'pending') as pending_alerts, (SELECT STRING_AGG(DISTINCT COALESCE(bt.name, b.description), '، ') FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = s.id AND b.type = 'negative' AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.behavior_id = b.id)) as pending_violations FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.circle_id = ${circle_id} AND s.name LIKE ${'%' + search + '%'} ORDER BY s.name LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      } else if (circle_id) {
        students = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.notes, s.circle_id, c.name as circle_name, c.teacher_name, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'negative') as negative_count, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'positive') as positive_count, (SELECT COUNT(*)::int FROM alerts a WHERE a.student_id = s.id AND a.status = 'pending') as pending_alerts, (SELECT STRING_AGG(DISTINCT COALESCE(bt.name, b.description), '، ') FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = s.id AND b.type = 'negative' AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.behavior_id = b.id)) as pending_violations FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.circle_id = ${circle_id} ORDER BY s.name LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      } else if (search) {
        students = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.notes, s.circle_id, c.name as circle_name, c.teacher_name, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'negative') as negative_count, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'positive') as positive_count, (SELECT COUNT(*)::int FROM alerts a WHERE a.student_id = s.id AND a.status = 'pending') as pending_alerts, (SELECT STRING_AGG(DISTINCT COALESCE(bt.name, b.description), '، ') FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = s.id AND b.type = 'negative' AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.behavior_id = b.id)) as pending_violations FROM students s JOIN circles c ON s.circle_id = c.id WHERE s.name LIKE ${'%' + search + '%'} ORDER BY s.name LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      } else {
        students = await sql`SELECT s.id, s.name, s.student_phone, s.parent_phone_1, s.parent_phone_2, s.notes, s.circle_id, c.name as circle_name, c.teacher_name, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'negative') as negative_count, (SELECT COUNT(*)::int FROM behaviors b WHERE b.student_id = s.id AND b.type = 'positive') as positive_count, (SELECT COUNT(*)::int FROM alerts a WHERE a.student_id = s.id AND a.status = 'pending') as pending_alerts, (SELECT STRING_AGG(DISTINCT COALESCE(bt.name, b.description), '، ') FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = s.id AND b.type = 'negative' AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.behavior_id = b.id)) as pending_violations FROM students s JOIN circles c ON s.circle_id = c.id ORDER BY s.name LIMIT ${parseInt(limit)} OFFSET ${offset}`;
      }
      const countResult = await sql`SELECT COUNT(*)::int as total FROM students`;
      res.json({ students, total: countResult[0].total, page: parseInt(page), limit: parseInt(limit) });
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
    try {
      const behaviors = await sql`
        SELECT b.id, b.type, b.description, b.date, b.created_at, bt.name as behavior_type_name
        FROM behaviors b LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id
        WHERE b.student_id = ${req.params.id} ORDER BY b.date DESC, b.created_at DESC`;
      for (const b of behaviors) {
        b.actions = await sql`SELECT id, description, action_date, created_at FROM actions WHERE behavior_id = ${b.id} ORDER BY action_date DESC`;
      }
      res.json(behaviors);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { name, circle_id, student_phone, parent_phone_1, parent_phone_2, notes } = req.body;
    if (!name || !circle_id) return res.status(400).json({ error: 'اسم الطالب والحلقة مطلوبان' });
    try {
      const result = await sql`INSERT INTO students (name, circle_id, student_phone, parent_phone_1, parent_phone_2, notes) VALUES (${name}, ${circle_id}, ${student_phone || null}, ${parent_phone_1 || null}, ${parent_phone_2 || null}, ${notes || null}) RETURNING id`;
      res.status(201).json({ id: result[0].id, name, circle_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { name, circle_id, student_phone, parent_phone_1, parent_phone_2, notes } = req.body;
    try {
      await sql`UPDATE students SET name = COALESCE(${name}, name), circle_id = COALESCE(${circle_id}, circle_id), student_phone = ${student_phone || null}, parent_phone_1 = ${parent_phone_1 || null}, parent_phone_2 = ${parent_phone_2 || null}, notes = ${notes || null} WHERE id = ${req.params.id}`;
      res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await sql`DELETE FROM students WHERE id = ${req.params.id}`;
      res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
