# Noisewatch — Requirements and Quick Start

This file lists the requirements and minimal steps to get Noisewatch running locally.

## System requirements

- A machine running Windows, macOS, or Linux.
- Node.js (LTS) >= 16.0.0 and npm >= 8.0.0 (see `package.json` engines).
- PostgreSQL server with PostGIS extension enabled (recommended).
- Optional: Docker (if you prefer to run Postgres/PostGIS in a container).
- A modern browser supporting Web Audio API and getUserMedia (Chrome, Edge, Safari, Firefox). For iOS Safari, the app must be served over HTTPS (or run via an HTTP tunnel to HTTPS like ngrok/localtunnel) to allow microphone access.

## Project dependencies

Run from the project root:

```powershell
npm install
```

Primary Node dependencies (from `package.json`):
- express
- dotenv
- pg
- cors

Dev dependencies:
- nodemon (optional, for development)

## Database requirements

- A Postgres database reachable from the server process.
- The `postgis` extension must be installed in the database used by Noisewatch (reports use geometry types).
- The database schema is provided in `db.sql` at the project root. Apply it to your database after creating the database:

Postgres example (local server):

1. Create DB and enable PostGIS:

```sql
CREATE DATABASE noisewatch;
\c noisewatch
CREATE EXTENSION postgis;
-- then run the SQL in db.sql to create tables and indices
```

Docker quick-start (recommended for testing):

```powershell
# Run a Postgres+PostGIS container (PostGIS 3.x with Postgres 15 tag is one option)
docker run --name noisewatch-postgis -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=noisewatch -p 5432:5432 -d postgis/postgis:15-3.3

# After the container is running, copy db.sql into it and run psql or run psql from host:
# On host (if psql installed):
psql -h localhost -U postgres -d noisewatch -f db.sql
```

Adjust versions and credentials to your environment.

## Environment variables

Create a `.env` file in the project root (or set these in your environment) with at least:

```text
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=noisewatch
DB_CALIB_OFFSET=115  # optional: server-side calibration offset in dB
NODE_ENV=development
GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE  # optional, used on pages that display maps
```

Notes:
- If your Postgres is on another host, set `DB_HOST` accordingly.
- `DB_CALIB_OFFSET` is applied server-side when incoming decibel values are negative (dBFS). Tweak as needed.

## HTTPS / Mobile testing

- iOS Safari requires secure context for microphone access. Use one of the following:
  - Serve the app via HTTPS (configure SSL/TLS on your host).
  - Use an HTTPS tunnel like `ngrok` or `localtunnel` to expose your local server over HTTPS while testing on mobile.

## Running the app (development)

1. Install dependencies:

```powershell
npm install
```

2. Create `.env` and ensure Postgres is running and `db.sql` has been applied.

3. Start server:

```powershell
npm start
# or for hot reload during development
npm run dev
```

4. Visit `http://localhost:3000` (or the `PORT` you set).

## Troubleshooting

- `ECONNREFUSED` when submitting reports: the server cannot reach Postgres. Check that Postgres is running, that host/port are reachable, and that credentials are correct.
- Microphone permission denied on iOS: ensure the site is served over HTTPS and the user interacts with the page (some iOS versions require a user gesture). See `views/report.html` for the "Enable Microphone" button that triggers explicit permission prompts.
- If you see negative dB values, the client uses raw dBFS values and the server will apply `DB_CALIB_OFFSET` when appropriate. Adjust `DB_CALIB_OFFSET` if you need to shift recorded levels to match SPL-like numbers.

## Optional: Releasing a zip for distribution

You can compress the project folder to a zip for transport. From the Desktop parent folder on Windows PowerShell:

```powershell
Compress-Archive -Path .\Noisewatch -DestinationPath .\Noisewatch.zip -Force
```

## Contact / More info

- Repo: https://github.com/ExplodingWater/Noisewatch
- Issues: https://github.com/ExplodingWater/Noisewatch/issues

---
Generated on: 2025-11-02
