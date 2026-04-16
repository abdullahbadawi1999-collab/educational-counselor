const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    const { behavior_id } = req.query;
    try {
      let actions;
      if (behavior_id) {
        actions = await sql`SELECT a.*, b.description as behavior_description, b.type as behavior_type, s.name as student_name FROM actions a JOIN behaviors b ON a.behavior_id = b.id JOIN students s ON b.student_id = s.id WHERE a.behavior_id = ${behavior_id} ORDER BY a.action_date DESC`;
      } else {
        actions = await sql`SELECT a.*, b.description as behavior_description, b.type as behavior_type, s.name as student_name FROM actions a JOIN behaviors b ON a.behavior_id = b.id JOIN students s ON b.student_id = s.id ORDER BY a.action_date DESC`;
      }
      res.json(actions);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { behavior_id, description, action_date } = req.body;
    if (!behavior_id || !description || !action_date) return res.status(400).json({ error: 'السلوك والوصف والتاريخ مطلوبين' });
    try {
      const result = await sql`INSERT INTO actions (behavior_id, description, action_date) VALUES (${behavior_id}, ${description}, ${action_date}) RETURNING id`;

      // Reverse sync: mark any pending alerts triggered by this behavior as done
      const bid = String(behavior_id);
      try {
        await sql`UPDATE alerts
          SET status = 'done',
              action_taken = COALESCE(action_taken, ${description}),
              action_date = COALESCE(action_date, ${action_date})
          WHERE status = 'pending'
            AND (trigger_behavior_ids = ${bid}
              OR trigger_behavior_ids LIKE ${bid + ',%'}
              OR trigger_behavior_ids LIKE ${'%,' + bid}
              OR trigger_behavior_ids LIKE ${'%,' + bid + ',%'})`;
      } catch (e) { console.error('Alert sync failed:', e.message); }

      res.status(201).json({ id: result[0].id, behavior_id, description, action_date });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { description, action_date } = req.body;
    try {
      await sql`UPDATE actions SET description = COALESCE(${description}, description), action_date = COALESCE(${action_date}, action_date) WHERE id = ${req.params.id}`;
      res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await sql`DELETE FROM actions WHERE id = ${req.params.id}`;
      res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
