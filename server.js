const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = 3000;

// PostgreSQL pool connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL database'))
  .catch((err) => console.error('❌ Database connection error:', err.stack));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Serve static pages
const serve = (p) => (req, res) => res.sendFile(path.join(__dirname, p));
app.get('/', serve('index.html'));
app.get('/map', serve('map.html'));
app.get(['/about', '/services'], serve('index.html'));
app.get(['/report', '/report/'], serve('report.html'));

// Import API routes and inject pool
const apiRouter = require('./routes/api');
app.use('/api', (req, res, next) => {
  next();
}, apiRouter);

// Start server
app.listen(port, () => {
  console.log(`🚀 Noisewatch server running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Access the app at: http://localhost:${port}`);
});
