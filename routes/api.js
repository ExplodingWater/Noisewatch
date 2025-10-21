const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/reports - Get all noise reports
router.get('/reports', async (req, res) => {
  try {
    const allReportsQuery = `
      SELECT id, decibels, description, ST_X(geom) AS longitude, ST_Y(geom) AS latitude, created_at
      FROM reports
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(allReportsQuery);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /api/reports - Create a new noise report
router.post('/reports', async (req, res) => {
  try {
    const { latitude, longitude, decibels, description } = req.body;

    // Validation
    if (!latitude || !longitude || !decibels || !description) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    if (typeof decibels !== 'number' || decibels < 0 || decibels > 200) {
      return res.status(400).json({ error: 'Decibels must be a number between 0 and 200' });
    }

    if (description.length > 255) {
      return res.status(400).json({ error: 'Description must be 255 characters or less' });
    }

    const newReportQuery = `
      INSERT INTO reports (decibels, description, geom)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
      RETURNING id, decibels, description, created_at;
    `;

    const values = [decibels, description, longitude, latitude];
    const result = await pool.query(newReportQuery, values);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating report:', err.message);
    res.status(500).json({ error: 'Server Error' });
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
        COUNT(CASE WHEN decibels BETWEEN 51 AND 60 THEN 1 END) as moderate_reports,
        COUNT(CASE WHEN decibels BETWEEN 61 AND 80 THEN 1 END) as high_reports,
        COUNT(CASE WHEN decibels > 80 THEN 1 END) as very_high_reports
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
      SELECT id, decibels, description, ST_X(geom) AS longitude, ST_Y(geom) AS latitude, created_at
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(recentReportsQuery);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent reports:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
