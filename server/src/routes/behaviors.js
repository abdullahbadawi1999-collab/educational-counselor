const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  router.get('/types', async (req, res) => {
    try {
      const types = await sql`SELECT id, name, type, category, severity, escalation_rule, is_active FROM behavior_types WHERE is_active = 1 ORDER BY type, category, name`;
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
    const { student_id, circle_id, type, from, to, page = 1, limit = 50 } = req.query;
    try {
      // Build query based on filters
      let behaviors;
      if (student_id) {
        behaviors = await sql`SELECT b.id, b.student_id, b.type, b.description, b.date, b.created_at, s.name as student_name, c.name as circle_name, c.id as circle_id, bt.name as behavior_type_name, (SELECT COUNT(*)::int FROM actions a WHERE a.behavior_id = b.id) as action_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE b.student_id = ${student_id} ORDER BY b.date DESC, b.created_at DESC LIMIT ${parseInt(limit)}`;
      } else if (circle_id) {
        behaviors = await sql`SELECT b.id, b.student_id, b.type, b.description, b.date, b.created_at, s.name as student_name, c.name as circle_name, c.id as circle_id, bt.name as behavior_type_name, (SELECT COUNT(*)::int FROM actions a WHERE a.behavior_id = b.id) as action_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id WHERE s.circle_id = ${circle_id} ORDER BY b.date DESC, b.created_at DESC LIMIT ${parseInt(limit)}`;
      } else {
        behaviors = await sql`SELECT b.id, b.student_id, b.type, b.description, b.date, b.created_at, s.name as student_name, c.name as circle_name, c.id as circle_id, bt.name as behavior_type_name, (SELECT COUNT(*)::int FROM actions a WHERE a.behavior_id = b.id) as action_count FROM behaviors b JOIN students s ON b.student_id = s.id JOIN circles c ON s.circle_id = c.id LEFT JOIN behavior_types bt ON b.behavior_type_id = bt.id ORDER BY b.date DESC, b.created_at DESC LIMIT ${parseInt(limit)}`;
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
    const { student_id, behavior_type_id, type, description, date } = req.body;
    if (!student_id || !type || !description || !date) return res.status(400).json({ error: 'الطالب والنوع والوصف والتاريخ مطلوبين' });
    try {
      const result = await sql`INSERT INTO behaviors (student_id, behavior_type_id, type, description, date) VALUES (${student_id}, ${behavior_type_id || null}, ${type}, ${description}, ${date}) RETURNING id`;
      const id = result[0].id;

      let generatedAlert = null;
      if (type === 'negative' && behavior_type_id) {
        try { generatedAlert = await checkCumulativeEscalation(sql, student_id, behavior_type_id, id); }
        catch (err) { console.error('Escalation error:', err.message); }
      }
      res.status(201).json({ id, student_id, type, description, date, generated_alert: generatedAlert });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  async function checkCumulativeEscalation(sql, studentId, behaviorTypeId, behaviorId) {
    const btRows = await sql`SELECT name, escalation_rule FROM behavior_types WHERE id = ${behaviorTypeId}`;
    if (!btRows.length || !btRows[0].escalation_rule) return null;
    const btName = btRows[0].name;
    const rule = JSON.parse(btRows[0].escalation_rule);

    const countRows = await sql`SELECT COUNT(*)::int as count FROM behaviors WHERE student_id = ${studentId} AND behavior_type_id = ${behaviorTypeId}`;
    const count = countRows[0].count;

    if (rule.immediate_warning) {
      const level = rule.immediate_warning;
      const names = { 1: 'تنبيه', 2: 'إنذار', 3: 'قرار' };
      await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, ${level}, ${names[level]}, ${btName + ' — إنذار فوري حسب الميثاق (المرة ' + count + ')'}, ${String(behaviorId)}, 'auto')`;
      return { level, level_name: names[level], reason: btName + ' — إنذار فوري' };
    }

    const cycleLength = rule.decision_at || rule.warning_at || rule.alert_at || 0;
    if (!cycleLength) return null;
    const posInCycle = ((count - 1) % cycleLength) + 1;
    const cycleNum = Math.ceil(count / cycleLength);

    if (rule.decision_at && posInCycle === rule.decision_at) {
      await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, 3, 'قرار', ${btName + ' — تكررت ' + count + ' مرات — يُحال للمشرفين (الدورة ' + cycleNum + ')'}, ${String(behaviorId)}, 'auto')`;
      return { level: 3, level_name: 'قرار', reason: btName + ' تكررت ' + count + ' مرات' };
    }
    if (rule.warning_at && posInCycle === rule.warning_at) {
      await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, 2, 'إنذار', ${btName + ' — تكررت ' + count + ' مرات — إنذار رسمي حسب الميثاق'}, ${String(behaviorId)}, 'auto')`;
      return { level: 2, level_name: 'إنذار', reason: btName + ' تكررت ' + count + ' مرات' };
    }
    if (rule.alert_at && posInCycle === rule.alert_at) {
      await sql`INSERT INTO alerts (student_id, level, level_name, reason, trigger_behavior_ids, trigger_type) VALUES (${studentId}, 1, 'تنبيه', ${btName + ' — تكررت ' + count + ' مرة — تواصل مع ولي الأمر'}, ${String(behaviorId)}, 'auto')`;
      return { level: 1, level_name: 'تنبيه', reason: btName + ' تكررت ' + count + ' مرة' };
    }
    return null;
  }

  router.put('/:id', async (req, res) => {
    const { type, description, date } = req.body;
    try {
      await sql`UPDATE behaviors SET type = COALESCE(${type}, type), description = COALESCE(${description}, description), date = COALESCE(${date}, date) WHERE id = ${req.params.id}`;
      res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const bid = String(req.params.id);
      // Cascade delete: remove alerts that were triggered by this behavior
      await sql`DELETE FROM alerts WHERE trigger_behavior_ids = ${bid} OR trigger_behavior_ids LIKE ${bid + ',%'} OR trigger_behavior_ids LIKE ${'%,' + bid} OR trigger_behavior_ids LIKE ${'%,' + bid + ',%'}`;
      // Then delete the behavior (actions cascade by FK)
      await sql`DELETE FROM behaviors WHERE id = ${req.params.id}`;
      res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
