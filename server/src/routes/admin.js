const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  // POST /api/admin/cleanup-positives
  // Removes all positive behaviors and positive behavior types from the
  // database. Idempotent — safe to run multiple times.
  router.post('/cleanup-positives', async (req, res) => {
    try {
      const deletedBehaviors = await sql`DELETE FROM behaviors WHERE type = 'positive' RETURNING id`;
      const deletedTypes = await sql`DELETE FROM behavior_types WHERE type = 'positive' RETURNING id`;
      res.json({
        message: 'تم تنظيف البيانات الإيجابية',
        deleted_behaviors: deletedBehaviors.length,
        deleted_types: deletedTypes.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
