const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Security: hide Express fingerprint
app.disable('x-powered-by');

// PostgreSQL pool connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
  // No SSL needed — DB runs on localhost
});

pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL database'))
  .catch((err) => console.error('❌ Database connection error:', err.stack));

// Middleware
// Security: restrict CORS to own domain only
const allowedOrigins = [
  'https://noisewatch.org',
  'https://www.noisewatch.org'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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