const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { sql } = require('./database/connection');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Mount routes (pass sql instead of db/saveDb)
app.use('/api/circles', require('./routes/circles')(sql));
app.use('/api/students', require('./routes/students')(sql));
app.use('/api/behaviors', require('./routes/behaviors')(sql));
app.use('/api/actions', require('./routes/actions')(sql));
app.use('/api/alerts', require('./routes/alerts')(sql));
app.use('/api/reports', require('./routes/reports')(sql));
app.use('/api/ai', require('./routes/ai')(sql));
app.use('/api/stats', require('./routes/stats')(sql));
app.use('/api/admin', require('./routes/admin')(sql));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
