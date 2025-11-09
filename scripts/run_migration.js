#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const sqlPath = path.join(__dirname, 'migrate_add_report_columns.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'noisewatch',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

(async () => {
  try {
    console.log('Running migration SQL:', sqlPath);
    const res = await pool.query(sql);
    console.log('Migration executed. Result:', res && res.command ? res.command : 'OK');
  } catch (err) {
    console.error('Migration error:', err.stack || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
