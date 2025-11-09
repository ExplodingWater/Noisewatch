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
  // Also return optional Map ID for vector maps / advanced features
  res.json({
    key: process.env.GOOGLE_MAPS_API_KEY || '',
    mapId: process.env.GOOGLE_MAPS_MAP_ID || ''
  });
});

// GET /api/reports - Get all noise reports
router.get('/reports', async (req, res) => {
  try {
    // MySQL: Use direct column names instead of ST_X/ST_Y
    const allReportsQuery = `
      SELECT id, decibels, description, longitude, latitude, created_at, submitted_time,
             device_info, source, accuracy_meters, audio_path, severity
      FROM reports
      ORDER BY created_at DESC
    `;

    // MySQL returns [rows, fields] array
    const [rows] = await pool.execute(allReportsQuery);
    console.log(`GET /api/reports -> returned ${rows.length} rows`);
    res.json(rows);
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
    const { latitude, longitude, decibels, description, device_info, source, accuracy_meters, audio_path } = req.body;

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

    // Compute server-side severity label to keep consistency
    let severity = 'quiet';
    if (storedDecibels > 100) {
      severity = 'very_high';
    } else if (storedDecibels > 80) {
      severity = 'loud';
    } else if (storedDecibels > 50) {
      severity = 'normal';
    }

    // MySQL: Use ? placeholders and direct lat/lng columns instead of PostGIS functions
    const newReportQuery = `
      INSERT INTO reports (decibels, description, latitude, longitude, submitted_time, device_info, source, accuracy_meters, audio_path, severity)
      VALUES (?, ?, ?, ?, CURRENT_TIME, ?, ?, ?, ?, ?)
    `;

    const values = [
      storedDecibels, 
      description, 
      latNum, 
      lngNum, 
      device_info || null, 
      source || null, 
      (typeof accuracy_meters === 'number' ? accuracy_meters : (accuracy_meters ? parseInt(accuracy_meters) : null)), 
      audio_path || null, 
      severity
    ];

    // MySQL returns [ResultSetHeader, fields]
    const [result] = await pool.execute(newReportQuery, values);

    // Return the created record
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        decibels: storedDecibels,
        description: description,
        latitude: latNum,
        longitude: lngNum,
        device_info: device_info || null,
        source: source || null,
        accuracy_meters: accuracy_meters || null,
        audio_path: audio_path || null,
        severity: severity
      }
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
      FROM reports
    `;

    const [rows] = await pool.execute(statsQuery);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/reports/recent - Get recent reports (last 24 hours)
router.get('/reports/recent', async (req, res) => {
  try {
    // MySQL: Use DATE_SUB instead of PostgreSQL's INTERVAL syntax
    const recentReportsQuery = `
      SELECT id, decibels, description, longitude, latitude, created_at, submitted_time,
             device_info, source, accuracy_meters, audio_path, severity
      FROM reports
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
    `;

    const [rows] = await pool.execute(recentReportsQuery);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching recent reports:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;

