const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/overview', async (req, res) => {
    try {
      const [students, circles, positive, negative, actions, pendingAlerts, totalAlerts] = await Promise.all([
        sql`SELECT COUNT(*)::int as c FROM students`,
        sql`SELECT COUNT(*)::int as c FROM circles`,
        sql`SELECT COUNT(*)::int as c FROM behaviors WHERE type = 'positive'`,
        sql`SELECT COUNT(*)::int as c FROM behaviors WHERE type = 'negative'`,
        sql`SELECT COUNT(*)::int as c FROM actions`,
        sql`SELECT COUNT(*)::int as c FROM alerts WHERE status = 'pending'`,
        sql`SELECT COUNT(*)::int as c FROM alerts`
      ]);
      res.json({
        total_students: students[0].c, total_circles: circles[0].c,
        positive_behaviors: positive[0].c, negative_behaviors: negative[0].c,
        total_actions: actions[0].c, pending_alerts: pendingAlerts[0].c,
        total_alerts: totalAlerts[0].c, alert_levels: {}
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/behaviors-by-circle', async (req, res) => {
    try {
      const data = await sql`SELECT c.name as circle_name, b.type, COUNT(b.id)::int as count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id GROUP BY c.id, c.name, b.type ORDER BY c.name`;
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/behaviors-by-month', async (req, res) => {
    try {
      const data = await sql`SELECT TO_CHAR(date::date, 'YYYY-MM') as month, type, COUNT(*)::int as count FROM behaviors GROUP BY month, type ORDER BY month`;
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/behaviors-by-type', async (req, res) => {
    try {
      const data = await sql`SELECT type, COUNT(*)::int as count FROM behaviors GROUP BY type`;
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/action-completion', async (req, res) => {
    try {
      const data = await sql`SELECT COUNT(DISTINCT b.id)::int as total_behaviors, COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN b.id END)::int as with_actions, COUNT(DISTINCT CASE WHEN a.id IS NULL THEN b.id END)::int as without_actions FROM behaviors b LEFT JOIN actions a ON b.id = a.behavior_id`;
      res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/top-students', async (req, res) => {
    const { type, limit = 10 } = req.query;
    try {
      let data;
      if (type) {
        data = await sql`SELECT s.id, s.name, c.name as circle_name, COUNT(b.id)::int as behavior_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE b.type = ${type} GROUP BY s.id, s.name, c.name ORDER BY behavior_count DESC LIMIT ${parseInt(limit)}`;
      } else {
        data = await sql`SELECT s.id, s.name, c.name as circle_name, COUNT(b.id)::int as behavior_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id GROUP BY s.id, s.name, c.name ORDER BY behavior_count DESC LIMIT ${parseInt(limit)}`;
      }
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
