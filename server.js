const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'map.html'));
});

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

app.post('/api/reports', async (req, res) => {
  try {
    const { latitude, longitude, decibels, description } = req.body;

    if (!latitude || !longitude || !decibels || !description) {
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    const newReportQuery = `
      INSERT INTO reports (decibels, description, geom)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
      RETURNING id, decibels, description, created_at;
    `;

    const values = [decibels, description, longitude, latitude];

    const result = await pool.query(newReportQuery, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const allReportsQuery = `
      SELECT id, decibels, ST_X(geom) AS longitude, ST_Y(geom) AS latitude
      FROM reports;
    `;

    const result = await pool.query(allReportsQuery);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
