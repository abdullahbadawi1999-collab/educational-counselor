const express = require('express');
const router = express.Router();

module.exports = function(sql) {
  // List semesters (newest/current first for the selector).
  router.get('/', async (req, res) => {
    try {
      const rows = await sql`SELECT id, name, hijri, gregorian, start_date, end_date, is_current, sort_order
        FROM semesters ORDER BY sort_order DESC`;
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
