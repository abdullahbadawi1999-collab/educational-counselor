const { neon } = require('@neondatabase/serverless');
const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(DATABASE_URL);

module.exports = { sql };
