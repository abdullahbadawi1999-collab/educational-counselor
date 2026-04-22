const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/', async (req, res) => {
    const { student_id, level, status } = req.query;
    try {
      let alerts;
      const baseSelect = 'a.*, s.name as student_name, c.name as circle_name, c.teacher_name';
      if (student_id && level && status) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.student_id = ${student_id} AND a.level = ${level} AND a.status = ${status} ORDER BY a.created_at DESC`;
      } else if (student_id) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.student_id = ${student_id} ORDER BY a.created_at DESC`;
      } else if (level && status) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.level = ${level} AND a.status = ${status} ORDER BY a.created_at DESC`;
      } else if (level) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.level = ${level} ORDER BY a.created_at DESC`;
      } else if (status) {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id WHERE a.status = ${status} ORDER BY a.created_at DESC`;
      } else {
        alerts = await sql`SELECT a.*, s.name as student_name, c.name as circle_name, c.teacher_name FROM alerts a JOIN students s ON a.student_id = s.id JOIN circles c ON s.circle_id = c.id ORDER BY a.created_at DESC`;
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
      if (status === 'done' && action_taken) {
        const date = action_date || new Date().toISOString().split('T')[0];
        const desc = `[${alert.level_name}] ${action_taken}`;

        // Parse trigger behavior IDs; fall back to latest behavior by this student if missing
        let ids = [];
        if (alert.trigger_behavior_ids) {
          ids = alert.trigger_behavior_ids.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }

        // Fallback: attach to the latest negative behavior of this student if no trigger ids
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

  // POST /alerts/recalculate/:studentId — wipe auto-generated alerts for a student
  // and regenerate them sequentially from the student's negative behaviors.
  router.post('/recalculate/:studentId', async (req, res) => {
    const studentId = parseInt(req.params.studentId);
    try {
      // 1) Delete all auto alerts for this student (preserve manual ones)
      await sql`DELETE FROM alerts WHERE student_id = ${studentId} AND trigger_type = 'auto'`;

      // 2) Get all negative behaviors ordered by creation
      const behaviors = await sql`SELECT b.id, b.behavior_type_id, b.student_id, bt.name as bt_name, bt.escalation_rule
        FROM behaviors b
        LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id
        WHERE b.student_id = ${studentId} AND b.type = 'negative' AND b.behavior_type_id IS NOT NULL
        ORDER BY b.created_at ASC, b.id ASC`;

      // 3) Per-type counts and replay escalation
      const counts = {}; // behavior_type_id -> count so far
      let regenerated = 0;
      for (const b of behaviors) {
        if (!b.escalation_rule) continue;
        const rule = JSON.parse(b.escalation_rule);
        counts[b.behavior_type_id] = (counts[b.behavior_type_id] || 0) + 1;
        const count = counts[b.behavior_type_id];
        const btName = b.bt_name;

        if (rule.immediate_warning) {
          const level = rule.immediate_warning;
          const names = { 1: 'تنبيه', 2: 'إنذار', 3: 'قرار' };
          await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, ${level}, ${names[level]}, ${btName + ' — إنذار فوري حسب الميثاق (المرة ' + count + ')'}, ${String(b.id)}, 'auto')`;
          regenerated++;
          continue;
        }
        if (rule.decision_at && count >= rule.decision_at) {
          await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, 3, 'قرار', ${btName + ' — تكررت ' + count + ' مرات — يُحال للمشرفين لاتخاذ القرار'}, ${String(b.id)}, 'auto')`;
          regenerated++;
        } else if (rule.warning_at && count === rule.warning_at) {
          await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, 2, 'إنذار', ${btName + ' — تكررت ' + count + ' مرات — إنذار رسمي حسب الميثاق'}, ${String(b.id)}, 'auto')`;
          regenerated++;
        } else if (rule.alert_at && count === rule.alert_at) {
          await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, 1, 'تنبيه', ${btName + ' — تكررت ' + count + ' مرة — تواصل مع ولي الأمر'}, ${String(b.id)}, 'auto')`;
          regenerated++;
        }
      }

      // 4) Re-apply any existing actions as "done" status on matching alerts
      const actions = await sql`SELECT a.description, a.action_date, b.id as bid
        FROM actions a JOIN behaviors b ON a.behavior_id = b.id
        WHERE b.student_id = ${studentId}`;
      for (const a of actions) {
        const bidStr = String(a.bid);
        await sql`UPDATE alerts
          SET status = 'done',
              action_taken = COALESCE(action_taken, ${a.description}),
              action_date = COALESCE(action_date, ${a.action_date})
          WHERE status = 'pending'
            AND (trigger_behavior_ids = ${bidStr}
              OR trigger_behavior_ids LIKE ${bidStr + ',%'}
              OR trigger_behavior_ids LIKE ${'%,' + bidStr}
              OR trigger_behavior_ids LIKE ${'%,' + bidStr + ',%'})`;
      }

      res.json({ message: 'تم إعادة حساب التنبيهات', regenerated });
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
