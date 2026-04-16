const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    const { student_id, level, status } = req.query;
    try {
      let alerts;
      if (student_id && level && status) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.student_id = ${student_id} AND a.level = ${level} AND a.status = ${status} ORDER BY a.created_at DESC`;
      } else if (student_id) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.student_id = ${student_id} ORDER BY a.created_at DESC`;
      } else if (level && status) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.level = ${level} AND a.status = ${status} ORDER BY a.created_at DESC`;
      } else if (level) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.level = ${level} ORDER BY a.created_at DESC`;
      } else if (status) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.status = ${status} ORDER BY a.created_at DESC`;
      } else {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id ORDER BY a.created_at DESC`;
      }
      const pendingResult = await sql`SELECT COUNT(*)::int as count FROM alerts WHERE status = 'pending'`;
      res.json({ alerts, pending_count: pendingResult[0].count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/student/:studentId', async (req, res) => {
    try {
      const alerts = await sql`SELECT a.*, s.name as student_name FROM alerts a JOIN students s ON a.student_id = s.id WHERE a.student_id = ${req.params.studentId} ORDER BY a.created_at DESC`;
      res.json(alerts);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', async (req, res) => {
    const { student_id, level, level_name, reason } = req.body;
    if (!student_id || !level || !reason) return res.status(400).json({ error: 'الطالب والمستوى والسبب مطلوبين' });
    try {
      const names = { 1: 'تنبيه', 2: 'إنذار', 3: 'قرار' };
      const result = await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_type) VALUES (${student_id}, ${level}, ${level_name || names[level]}, ${reason}, 'manual') RETURNING id`;
      res.status(201).json({ id: result[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', async (req, res) => {
    const { status, action_taken, action_date } = req.body;
    try {
      // Get alert details first (to sync action to behavior)
      const alerts = await sql`SELECT * FROM alerts WHERE id = ${req.params.id}`;
      if (!alerts.length) return res.status(404).json({ error: 'التنبيه غير موجود' });
      const alert = alerts[0];

      await sql`UPDATE alerts SET status = COALESCE(${status}, status), action_taken = COALESCE(${action_taken}, action_taken), action_date = COALESCE(${action_date}, action_date) WHERE id = ${req.params.id}`;

      // If marking as done with an action, mirror action into behavior's actions table
      if (status === 'done' && action_taken && alert.trigger_behavior_ids) {
        const ids = alert.trigger_behavior_ids.split(',').map(s => s.trim()).filter(Boolean);
        const date = action_date || new Date().toISOString().split('T')[0];
        const desc = `[${alert.level_name}] ${action_taken}`;
        for (const bid of ids) {
          try {
            await sql`INSERT INTO actions (behavior_id, description, action_date) VALUES (${bid}, ${desc}, ${date})`;
          } catch (e) { /* behavior may not exist — skip silently */ }
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

  router.get('/escalation/:studentId', async (req, res) => {
    try {
      const behaviorCounts = await sql`SELECT bt.id as type_id, bt.name, bt.category, bt.severity, bt.escalation_rule, COUNT(b.id)::int as count FROM behaviors b JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = ${req.params.studentId} AND b.type = 'negative' GROUP BY bt.id, bt.name, bt.category, bt.severity, bt.escalation_rule`;
      const alertCounts = await sql`SELECT level, COUNT(*)::int as count FROM alerts WHERE student_id = ${req.params.studentId} GROUP BY level`;
      const ac = {};
      for (const row of alertCounts) ac[row.level] = row.count;

      const parsed = behaviorCounts.map(bc => ({
        ...bc, escalation_rule: bc.escalation_rule ? JSON.parse(bc.escalation_rule) : null
      }));
      res.json({ behavior_counts: parsed, alert_counts: ac, pending_escalations: [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
