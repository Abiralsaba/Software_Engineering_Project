'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
async function migrate(target) {
  if (!['central_govt_db_test', 'central_govt_db'].includes(target)) throw new Error('Only the authorized development/test databases are allowed.');
  const sql = fs.readFileSync(path.resolve(__dirname, '../../src/database/migrations/008_nid_applicant_assistant.sql'), 'utf8');
  const clean = sql.replace(/--[^\n]*/g, '').trim();
  const statements = clean.split(';').map(s => s.trim()).filter(Boolean);
  if (statements.some(s => !/^CREATE TABLE IF NOT EXISTS (nid_applicant_accounts|nid_first_time_applications|nid_application_documents|nid_application_status_history|assistant_sessions|assistant_confirmations|assistant_events)\s*\(/.test(s)) || /\b(USE|DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE)\b/i.test(clean.replace(/ON UPDATE CURRENT_TIMESTAMP/g, '')) || /`|\/\*|\b\w+\s*\.\s*\w+/.test(clean)) throw new Error('Migration guard: only reviewed, unqualified CREATE TABLE statements allowed.');
  const c = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: target });
  try {
    const [[row]] = await c.query('SELECT DATABASE() db');
    if (row.db !== target) throw new Error('Wrong database');
    for (const statement of statements) await c.query(statement);
    console.log(`Verified ${statements.length} additive tables in ${target}. No existing data changed.`);
  } finally { await c.end(); }
}
if (require.main === module) migrate(process.argv[2]).catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
module.exports = { migrate };
