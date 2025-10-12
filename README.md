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
