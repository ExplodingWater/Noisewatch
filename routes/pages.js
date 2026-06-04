const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Injects Maps config into an HTML file server-side (avoids public /api/maps-key endpoint)
function serveMapsPage(htmlFile) {
  return (req, res) => {
    const filePath = path.join(__dirname, '../views', htmlFile);
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) return res.status(500).send('Page not found');
      const injection = `<script>window.__MAPS_CONFIG={key:${JSON.stringify(process.env.GOOGLE_MAPS_API_KEY||'')},mapId:${JSON.stringify(process.env.GOOGLE_MAPS_MAP_ID||'')}};</script>`;
      const injected = html.replace('</head>', `${injection}</head>`);
      res.setHeader('Content-Type', 'text/html');
      res.send(injected);
    });
  };
}

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

router.get('/map', serveMapsPage('map.html'));

router.get('/report', serveMapsPage('report.html'));

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

router.get('/en/map', serveMapsPage('map-en.html'));

router.get('/en/report', serveMapsPage('report-en.html'));

// Redirect old routes to new structure
router.get('/report/', (req, res) => {
  res.redirect('/report');
});

module.exports = router;
