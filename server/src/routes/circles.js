const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    try {
      const circles = await sql`
        SELECT c.id, c.name, c.teacher_name, c.created_at,
               COUNT(s.id)::int as student_count
        FROM circles c
        LEFT JOIN students s ON c.id = s.circle_id
        GROUP BY c.id ORDER BY c.name`;
      res.json(circles);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/:id', async (req, res) => {
    try {
      const circles = await sql`SELECT * FROM circles WHERE id = ${req.params.id}`;
      if (!circles.length) return res.status(404).json({ error: 'الحلقة غير موجودة' });
      const students = await sql`SELECT id, name, student_phone, parent_phone_1, parent_phone_2 FROM students WHERE circle_id = ${req.params.id} ORDER BY name`;
      res.json({ ...circles[0], students });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { name, teacher_name } = req.body;
    if (!name || !teacher_name) return res.status(400).json({ error: 'اسم الحلقة واسم المعلم مطلوبان' });
    try {
      const result = await sql`INSERT INTO circles (name, teacher_name) VALUES (${name}, ${teacher_name}) RETURNING id`;
      res.status(201).json({ id: result[0].id, name, teacher_name });
    } catch (err) {
      if (err.message?.includes('unique')) return res.status(400).json({ error: 'اسم الحلقة موجود مسبقاً' });
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    const { name, teacher_name } = req.body;
    try {
      await sql`UPDATE circles SET name = COALESCE(${name}, name), teacher_name = COALESCE(${teacher_name}, teacher_name) WHERE id = ${req.params.id}`;
      res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await sql`DELETE FROM circles WHERE id = ${req.params.id}`;
      res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
