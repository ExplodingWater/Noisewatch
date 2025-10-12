// Import required packages
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // To load environment variables from .env file

// --- 1. INITIAL SETUP ---
const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable the express server to parse JSON formatted request bodies
app.use(express.static('.')); // Serve static files from the root directory

// --- 2. DATABASE CONNECTION ---
// Create a new Pool instance to connect to your PostgreSQL database.
// It will automatically use the environment variables (PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT)
// or you can pass them in an object.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- 3. ROUTES ---

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the map page
app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'map.html'));
});

// Serve other pages (they all use the same index.html with different sections)
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/report', (req, res) => {
  res.sendFile(path.join(__dirname, 'report.html'));
});

app.get('/report/', (req, res) => {
  res.sendFile(path.join(__dirname, 'report.html'));
});

// --- 4. API ENDPOINTS (ROUTES) ---

/**
 * @route   POST /api/reports
 * @desc    Create a new commotion report
 * @access  Public
 */
app.post('/api/reports', async (req, res) => {
  try {
    const { latitude, longitude, decibels, description } = req.body;

    // Basic validation
    if (!latitude || !longitude || !decibels || !description) {
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    // This is the GIS part! We use a PostGIS function ST_SetSRID(ST_MakePoint(lon, lat), 4326)
    // to create a geographic point from the latitude and longitude.
    // SRID 4326 is the standard for GPS coordinates (WGS 84).
    const newReportQuery = `
      INSERT INTO reports (decibels, description, geom)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
      RETURNING id, decibels, description, created_at;
    `;

    const values = [decibels, description, longitude, latitude]; // Note: longitude comes first for ST_MakePoint

    const result = await pool.query(newReportQuery, values);

    res.status(201).json(result.rows[0]); // Send back the newly created report
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @route   GET /api/reports
 * @desc    Get all commotion reports with their locations
 * @access  Public
 */
app.get('/api/reports', async (req, res) => {
  try {
    // Here we use PostGIS function ST_X and ST_Y to extract the longitude and latitude
    // from the 'geom' geometry column.
    const allReportsQuery = `
      SELECT id, decibels, ST_X(geom) AS longitude, ST_Y(geom) AS latitude
      FROM reports;
    `;

    const result = await pool.query(allReportsQuery);

    res.json(result.rows); // Send all reports as a JSON array
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// --- 5. START THE SERVER ---
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
