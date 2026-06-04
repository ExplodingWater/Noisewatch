const express = require('express');
const router = express.Router();
const path = require('path');
const tiranaGeo = require('../data/tirana_polygon.json');
const pool = require('../config/database.js'); // add this line

// Extract Tirana polygon (GeoJSON uses [lng, lat])
const TIRANA_POLYGON =
  tiranaGeo?.features?.[0]?.geometry?.coordinates?.[0] || null;

// Ray-casting algorithm for point-in-polygon
function pointInPolygon(lat, lng, polygon) {
  if (!polygon || !Array.isArray(polygon)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    const intersect = ((xi > lat) !== (xj > lat)) &&
      (lng < ((yj - yi) * (lat - xi)) / (xj - xi + 0.0) + yi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// NOTE: /api/maps-key endpoint removed for security.
// The Google Maps API key must NOT be served via a public API endpoint.
// Embed it server-side at render time instead (e.g. via a template or
// injected into the HTML by your pages router).

// GET all reports
router.get('/reports', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, decibels, description,
             ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
             created_at, submitted_time,
             device_info, source, accuracy_meters, audio_path, severity
      FROM reports
      ORDER BY created_at DESC;
    `);
    console.log(`GET /api/reports -> ${result.rows.length} rows`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST new report
router.post('/reports', async (req, res) => {
  try {
    console.log('POST /api/reports body:', req.body);

    const {
      latitude,
      longitude,
      decibels,
      description,
      device_info,
      source,
      accuracy_meters,
      audio_path
    } = req.body;

    // Sanitize audio_path: only allow safe filenames, no directory traversal
    const safeAudioPath = audio_path
      ? path.basename(String(audio_path)).replace(/[^a-zA-Z0-9._-]/g, '')
      : null;

    if (
      latitude == null ||
      longitude == null ||
      decibels == null ||
      !description
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    let dbValue = parseFloat(decibels);

    if (!isFinite(latNum) || !isFinite(lngNum) || !isFinite(dbValue)) {
      return res.status(400).json({ error: 'Invalid numeric fields' });
    }

    if (description.length > 255) {
      return res.status(400).json({ error: 'Description too long' });
    }

    const CLIENT_NEGATIVE_THRESHOLD = -1;
    const CALIB_OFFSET = parseFloat(process.env.DB_CALIB_OFFSET) || 115;
    if (dbValue <= CLIENT_NEGATIVE_THRESHOLD) dbValue += CALIB_OFFSET;

    dbValue = Math.round(Math.min(200, Math.max(0, dbValue)));

    if (TIRANA_POLYGON && !pointInPolygon(latNum, lngNum, TIRANA_POLYGON)) {
      return res.status(400).json({ error: 'Location outside Tirana area' });
    }

    let severity = 'quiet';
    if (dbValue > 100) severity = 'very_high';
    else if (dbValue > 80) severity = 'loud';
    else if (dbValue > 50) severity = 'normal';

    const query = `
      INSERT INTO reports
        (decibels, description, geom, submitted_time,
         device_info, source, accuracy_meters, audio_path, severity)
      VALUES
        ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326),
         CURRENT_TIME, $5, $6, $7, $8, $9)
      RETURNING id, decibels, description, created_at, submitted_time,
                device_info, source, accuracy_meters, audio_path, severity;
    `;

    const values = [
      dbValue,
      description,
      lngNum,
      latNum,
      device_info || null,
      source || null,
      accuracy_meters ? parseInt(accuracy_meters) : null,
      safeAudioPath,
      severity
    ];

    const result = await pool.query(query, values);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating report:', err.stack || err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Noise statistics
router.get('/reports/stats', async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Recent reports
router.get('/reports/recent', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, decibels, description,
             ST_X(geom) AS longitude, ST_Y(geom) AS latitude,
             created_at, submitted_time,
             device_info, source, accuracy_meters, audio_path, severity
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent reports:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
