const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Serve static pages
const serve = (p) => (req, res) => res.sendFile(path.join(__dirname, p));
app.get('/', serve('index.html'));
app.get('/map', serve('map.html'));
app.get(['/about', '/services'], serve('index.html'));
app.get(['/report', '/report/'], serve('report.html'));

// Import API routes
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// Start server
app.listen(port, () => {
  console.log(`🚀 Noisewatch server running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Access the app at: http://localhost:${port}`);
});

