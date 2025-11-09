const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const tiranaGeo = require('../data/tirana_polygon.json');

// Extract the first polygon coordinates (GeoJSON uses [lng, lat])
const TIRANA_POLYGON = (tiranaGeo && tiranaGeo.features && tiranaGeo.features[0] && tiranaGeo.features[0].geometry && tiranaGeo.features[0].geometry.coordinates && tiranaGeo.features[0].geometry.coordinates[0]) || null;

// Simple point-in-polygon (ray-casting) using arrays of [lng, lat]
function pointInPolygon(lat, lng, polygon) {
  if (!polygon || !Array.isArray(polygon)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0]; // convert to lat,lng
    const xj = polygon[j][1], yj = polygon[j][0];

    const intersect = ((xi > lat) !== (xj > lat)) && (lng < (yj - yi) * (lat - xi) / (xj - xi + 0.0) + yi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Expose API to return the maps key to the client (serves from env). Keep careful access control in production.
router.get('/maps-key', (req, res) => {
  res.json({ key: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// GET /api/reports - Get all noise reports
router.get('/reports', async (req, res) => {
  try {
    const allReportsQuery = `
      SELECT id, decibels, description, ST_X(geom) AS longitude, ST_Y(geom) AS latitude, created_at, submitted_time
      FROM reports
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(allReportsQuery);
    console.log(`GET /api/reports -> returned ${result.rows.length} rows`);
    res.json(result.rows);
  } catch (err) {
    // Log full error for debugging
    console.error('Error fetching reports:', err.stack || err);
    res.status(500).json({ error: 'Server Error', ...(process.env.NODE_ENV === 'development' && { details: err.message }) });
  }
});

// POST /api/reports - Create a new noise report
router.post('/reports', async (req, res) => {
  try {
    // Log incoming request body to help diagnose client-side submission problems
    console.log('POST /api/reports body:', req.body);
    const { latitude, longitude, decibels, description } = req.body;

    // Basic validation
    if (typeof latitude === 'undefined' || typeof longitude === 'undefined' || typeof decibels === 'undefined' || !description) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    if (typeof decibels !== 'number' || !isFinite(decibels)) {
      return res.status(400).json({ error: 'Decibels must be a valid number' });
    }

    if (description.length > 255) {
      return res.status(400).json({ error: 'Description must be 255 characters or less' });
    }

    // Calibrate client-side measurements if they arrived as negative dBFS
    // Some devices report negative dB (dBFS). Allow negative values and map
    // them into an approximate SPL-like positive range using an offset.
    const CLIENT_NEGATIVE_THRESHOLD = -1; // if decibels <= this, treat as dBFS
  const CALIB_OFFSET = parseFloat(process.env.DB_CALIB_OFFSET) || 115; // configurable via env (lowered slightly)

    let storedDecibels = Math.round(decibels);

    if (storedDecibels <= CLIENT_NEGATIVE_THRESHOLD) {
      // Treat as a dBFS measurement and add offset to approximate SPL
      storedDecibels = Math.round(storedDecibels + CALIB_OFFSET);
    }

    // Final clamp to database-acceptable range
    const MIN_DB = 0;
    const MAX_DB = 200;
    storedDecibels = Math.max(MIN_DB, Math.min(MAX_DB, storedDecibels));

    // Server-side: ensure coordinates are within Tirana polygon (if available)
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (!isFinite(latNum) || !isFinite(lngNum)) {
      return res.status(400).json({ error: 'Invalid latitude/longitude' });
    }
    if (TIRANA_POLYGON) {
      const inside = pointInPolygon(latNum, lngNum, TIRANA_POLYGON);
      if (!inside) {
        return res.status(400).json({ error: 'Location outside allowed reporting area (Tirana)' });
      }
    }

    const newReportQuery = `
      INSERT INTO reports (decibels, description, geom, submitted_time)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), CURRENT_TIME)
      RETURNING id, decibels, description, created_at, submitted_time;
    `;

    const values = [storedDecibels, description, longitude, latitude];
    const result = await pool.query(newReportQuery, values);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    // Log full error stack for debugging
    console.error('Error creating report:', err.stack || err);
    res.status(500).json({ error: 'Server Error', ...(process.env.NODE_ENV === 'development' && { details: err.message }) });
  }
});

// GET /api/reports/stats - Get noise statistics
router.get('/reports/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_reports,
        AVG(decibels) as average_decibels,
        MIN(decibels) as min_decibels,
        MAX(decibels) as max_decibels,
        COUNT(CASE WHEN decibels <= 50 THEN 1 END) as quiet_reports,
        COUNT(CASE WHEN decibels BETWEEN 51 AND 80 THEN 1 END) as normal_reports,
        COUNT(CASE WHEN decibels BETWEEN 81 AND 100 THEN 1 END) as high_reports,
        COUNT(CASE WHEN decibels > 100 THEN 1 END) as very_high_reports
      FROM reports;
    `;

    const result = await pool.query(statsQuery);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/reports/recent - Get recent reports (last 24 hours)
router.get('/reports/recent', async (req, res) => {
  try {
    const recentReportsQuery = `
      SELECT id, decibels, description, ST_X(geom) AS longitude, ST_Y(geom) AS latitude, created_at, submitted_time
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC;
    `;

    // Note: include submitted_time for client display if present

    const result = await pool.query(recentReportsQuery);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent reports:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
