const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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

// Serve static files from 'public' directory (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Helper to serve HTML files from 'views' directory
const serveView = (filename) => (req, res) => {
    res.sendFile(path.join(__dirname, 'views', filename));
};

// Routes
app.get('/', serveView('index.html'));
app.get('/en', serveView('en.html')); // English Home

app.get('/about', serveView('about.html'));
app.get('/about-en', serveView('about-en.html'));

app.get('/services', serveView('services.html'));
app.get('/services-en', serveView('services-en.html'));

app.get('/map', serveView('map.html'));
app.get('/map-en', serveView('map-en.html'));

app.get('/report', serveView('report.html'));
app.get('/report-en', serveView('report-en.html'));

// Import API routes and inject pool
const apiRouter = require('./routes/api');
app.use('/api', (req, res, next) => {
  next();
}, apiRouter);

// Start server
app.listen(port, () => {
  console.log(`🚀 Noisewatch server running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});