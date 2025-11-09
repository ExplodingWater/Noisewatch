const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
// Serve data files (GeoJSON, etc.)
app.use('/data', express.static(path.join(__dirname, 'data')));

// Routes
app.use('/api', require('./routes/api'));
app.use('/', require('./routes/pages'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
// Use a no-path middleware so we don't pass a literal '*' into path-to-regexp
// which now rejects '*' as a route string (causes PathError).
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Noisewatch server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Access the app at: http://localhost:${PORT}`);
  // Check Google Maps API key availability and warn if missing or likely misconfigured
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!mapsKey) {
    console.warn('⚠️  GOOGLE_MAPS_API_KEY is not set. The map may show a "For development purposes only" overlay or fail to load.');
  } else if (process.env.NODE_ENV === 'production') {
    // In production, remind to ensure billing and API restrictions are correct
    console.log('🔑 GOOGLE_MAPS_API_KEY detected. Ensure the key has Billing enabled and Maps JavaScript API is allowed for your production domain to avoid "For development purposes only" overlays.');
  }
});

module.exports = app;
