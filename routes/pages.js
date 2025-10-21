const express = require('express');
const path = require('path');
const router = express.Router();

// Albanian pages
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

router.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/about.html'));
});

router.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/services.html'));
});

router.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/map.html'));
});

router.get('/report', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/report.html'));
});

// English pages
router.get('/en', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/en.html'));
});

router.get('/en/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/about-en.html'));
});

router.get('/en/services', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/services-en.html'));
});

router.get('/en/map', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/map-en.html'));
});

router.get('/en/report', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/report-en.html'));
});

// Redirect old routes to new structure
router.get('/report/', (req, res) => {
  res.redirect('/report');
});

module.exports = router;
