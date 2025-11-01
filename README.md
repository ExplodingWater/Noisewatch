# Noisewatch Tirana

A noise monitoring web application for Tirana that displays noise reports on an interactive Google Maps heatmap.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
1. Install PostgreSQL with PostGIS extension
2. Create a database and enable PostGIS:
   ```sql
   CREATE EXTENSION postgis;
   ```
3. Run the database schema:
   ```bash
   psql -d your_database_name -f db.sql
   ```

### 3. Environment Configuration
Create a `.env` file in the root directory with the following variables:
```
DB_USER=your_username
DB_HOST=localhost
DB_DATABASE=your_database_name
DB_PASSWORD=your_password
DB_PORT=5432
```

### 4. Start the Server
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Features

- **Home Page**: Main landing page with navigation
- **Map Page**: Interactive Google Maps with noise heatmap visualization
- **API Endpoints**:
  - `GET /api/reports` - Retrieve all noise reports
  - `POST /api/reports` - Submit a new noise report

## Project Structure

- `server.js` - Express server with API endpoints
- `index.html` - Main application page
- `map.html` - Map page with Google Maps integration
- `maplogic.js` - Google Maps and heatmap logic
- `style.css` - Application styling
- `db.sql` - Database schema
- `package.json` - Node.js dependencies

## API Usage

### Submit a Noise Report
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 41.3275,
    "longitude": 19.8187,
    "decibels": 85,
    "description": "Loud construction noise"
  }'
```

### Get All Reports
```bash
curl http://localhost:3000/api/reports
```

## Testing from mobile / remote devices (ngrok)

For quick testing from your phone (including iOS) you need a secure (HTTPS) URL so browser APIs like microphone and geolocation can be used.

Recommended approach: use ngrok to expose your local server over HTTPS.

1. Start the server locally (default port 3000):
```bash
npm start
```

2. In a separate terminal, start ngrok pointing at your local port:
```bash
# install from https://ngrok.com and set your authtoken for reserved urls (optional)
ngrok http 3000
```

3. ngrok will print forwarding addresses. Use the HTTPS URL it provides (for example `https://abcd-1234.ngrok.io`) on your mobile device.

Important notes for mobile / iOS permissions
- Always use the HTTPS ngrok URL (not the HTTP one). getUserMedia (microphone) and geolocation require secure contexts.
- iOS specifics:
  - Safari on iOS requires WebKit and enforces secure contexts. Microphone access via getUserMedia is available in recent iOS versions (iOS 15+).
  - Permission prompts must be triggered by a user gesture (e.g., button click). The app already uses user-triggered permission prompts; avoid requesting microphone on page load.
  - If the microphone prompt doesn't appear, ensure you opened the HTTPS ngrok URL (and not a cached HTTP page), and try a hard refresh.

Google Maps API key and referrers
- If your Google Maps API key is restricted by HTTP referrers, add the ngrok HTTPS domain (`https://*.ngrok.io` or the exact domain) to the allowed referrers in the Google Cloud Console while testing. After testing, tighten restrictions back to your production domain.
- Avoid leaving keys unrestricted in production; use referrer restrictions or a server-side proxy for sensitive keys.

Alternatives
- localtunnel (quick, free):
  ```bash
  npx localtunnel --port 3000 --subdomain my-noisewatch-test
  ```
  This will also provide an HTTPS URL but the subdomain is not guaranteed to persist.
- Deploy to a staging environment (Render, Vercel, Railway, Fly.io) for a stable HTTPS endpoint for testing.

Security reminder
- Exposing your local server publicly can reveal development endpoints. Keep secrets out of your `.env` when testing public tunnels or use temporary/test keys. Revoke or rotate any credentials used for testing.

Troubleshooting
- If audio permissions are denied on iOS, ask users to open Settings → Safari → Microphone and enable it, or use Safari's site settings while the site is open.
- If Google Maps fails to load on the tunneled domain, check the browser console for API key errors and verify referrer settings.

