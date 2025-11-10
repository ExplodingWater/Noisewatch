# MySQL Migration Guide for Noisewatch on Hostinger

This guide will help you convert Noisewatch from PostgreSQL/PostGIS to MySQL with spatial support.

## Part 1: Create MySQL Database on Hostinger

### Step 1: Access Hostinger hPanel

1. Log into your Hostinger account
2. Go to **hPanel** (Hosting Control Panel)
3. Navigate to **Databases** → **MySQL Databases**

### Step 2: Create Database

1. Click **"Create New Database"**
2. Database name: `noisewatch` (or `u734807911_noisewatch`)
3. Click **Create**
4. **Note down the database name** - Hostinger usually prefixes it with your username

### Step 3: Create Database User

1. Scroll to **"MySQL Users"** section
2. Click **"Create New User"**
3. Username: `noisewatch_user` (will be prefixed like `u734807911_noisewatch_user`)
4. Password: Create a strong password
5. Click **Create**
6. **Note down the full username and password**

### Step 4: Add User to Database

1. Scroll to **"Add User to Database"** section
2. Select your user: `u734807911_noisewatch_user`
3. Select your database: `u734807911_noisewatch`
4. Click **Add**
5. Select **"ALL PRIVILEGES"**
6. Click **"Make Changes"**

### Step 5: Note Your Database Credentials

You should now have:
- **Database Host:** Usually `localhost` or `127.0.0.1`
- **Database Name:** `u734807911_noisewatch` (with your prefix)
- **Database User:** `u734807911_noisewatch_user` (with your prefix)
- **Database Password:** Your chosen password
- **Port:** `3306` (default MySQL port)

## Part 2: Create MySQL Schema

### Step 1: Access phpMyAdmin

1. In hPanel, go to **Databases** → **phpMyAdmin**
2. Click on your database name in the left sidebar
3. Click the **SQL** tab at the top

### Step 2: Run This SQL Script

Copy and paste this entire script into the SQL tab and click **Go**:

```sql
-- Enable spatial support (MySQL 5.7+ has built-in spatial support)
-- No extension needed like PostGIS

-- Drop table if exists
DROP TABLE IF EXISTS reports;

-- Create reports table with MySQL spatial support
CREATE TABLE reports (
    -- Primary key with auto increment
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Noise level in decibels
    decibels INT NOT NULL,
    
    -- User description
    description VARCHAR(255) NOT NULL,
    
    -- Latitude and Longitude as separate columns (easier for MySQL)
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Optional: MySQL POINT type for spatial queries (if needed later)
    -- geom POINT NOT NULL SRID 4326,
    
    -- Submission time (wall-clock time)
    submitted_time TIME DEFAULT NULL,
    
    -- Timestamp when report was created
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional fields
    device_info TEXT,
    source VARCHAR(32),
    accuracy_meters INT,
    audio_path TEXT,
    severity VARCHAR(16),
    
    -- Spatial index on latitude/longitude for faster location queries
    INDEX idx_location (latitude, longitude),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert a test record to verify it works
INSERT INTO reports (decibels, description, latitude, longitude, severity)
VALUES (85, 'Test report - Loud construction', 41.3275, 19.8187, 'loud');

-- Verify the test record
SELECT * FROM reports;
```

### Step 3: Verify Table Creation

After running the script, you should see:
- ✅ "1 row affected" message
- ✅ The test record displayed

If you see errors, check:
- MySQL version (should be 5.7+)
- Database privileges

## Part 3: Update Application Code

Now we need to update your Node.js application to use MySQL instead of PostgreSQL.

### Step 1: Install MySQL Package

SSH into your server and run:

```bash
cd /home/u734807911/noisewatch

# Install mysql2 package (faster and better than mysql)
npm install mysql2

# You can optionally remove pg package
# npm uninstall pg
```

### Step 2: Update .env File

```bash
nano .env
```

Update with your MySQL credentials:

```env
# MySQL Database Configuration
DB_HOST=localhost
DB_USER=u734807911_noisewatch_user
DB_PASSWORD=your_mysql_password_here
DB_DATABASE=u734807911_noisewatch
DB_PORT=3306

# Application Configuration
NODE_ENV=production
PORT=3000

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

Save and exit (Ctrl+X, Y, Enter).

### Step 3: Update Database Configuration File

The `config/database.js` file needs to be updated to use MySQL. I'll provide the updated code in the next section.

### Step 4: Update API Routes

The `routes/api.js` file needs to be updated because:
- MySQL doesn't have `ST_X()`, `ST_Y()`, `ST_MakePoint()` functions
- MySQL uses `?` placeholders instead of `$1, $2, $3`
- MySQL returns different result format

I'll provide the updated code in the next section.

## Part 4: Code Changes Required

You'll need to update these files:

### File 1: `config/database.js`

Replace the entire file with MySQL connection:

```javascript
const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection error:', err.message);
  });

module.exports = pool;
```

### File 2: `routes/api.js` - Key Changes

The main changes needed:
1. Replace `$1, $2, $3` with `?` placeholders
2. Replace `ST_X(geom)` with `longitude` column
3. Replace `ST_Y(geom)` with `latitude` column
4. Replace `ST_SetSRID(ST_MakePoint(...))` with direct lat/lng insert
5. Change `result.rows` to `result[0]` (MySQL format)
6. Change `pool.query()` to use MySQL syntax

I'll create the updated files for you in the next step.

## Part 5: Testing the Migration

### Step 1: Test Database Connection

Create a test file:

```bash
nano test-db.js
```

Add this code:

```javascript
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT || 3306
    });/usr/bin/which: no nginx in (/home/u734807911/.nvm/versions/node/v24.11.0/bin:/usr/share/Modules/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/opt/golang/1.22.0/bin:/opt/go/bin)
    
    console.log('✅ Connected to MySQL!');
    
    const [rows] = await connection.execute('SELECT * FROM reports LIMIT 1');
    console.log('✅ Query successful:', rows);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConnection();
```

Run it:

```bash
node test-db.js
```

### Step 2: Start Your Application

```bash
# Using PM2 (recommended)
pm2 start app.js --name noisewatch
pm2 logs noisewatch

# Or directly
node app.js
```

### Step 3: Test the API

```bash
# Test GET reports
curl http://localhost:3000/api/reports

# Test POST report
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 41.3275,
    "longitude": 19.8187,
    "decibels": 75,
    "description": "Test noise report"
  }'
```

## Part 6: Common Issues & Solutions

### Issue 1: "Client does not support authentication protocol"

This happens with older MySQL versions. Fix:

```sql
-- In phpMyAdmin SQL tab:
ALTER USER 'u734807911_noisewatch_user'@'localhost' 
IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

### Issue 2: "Access denied for user"

- Double-check username includes the prefix (e.g., `u734807911_noisewatch_user`)
- Verify password is correct
- Ensure user has privileges on the database

### Issue 3: "Unknown database"

- Database name must include prefix (e.g., `u734807911_noisewatch`)
- Check database exists in phpMyAdmin

### Issue 4: "Cannot find module 'mysql2'"

```bash
cd /home/u734807911/noisewatch
npm install mysql2
```

## Part 7: Next Steps

After successful migration:

1. ✅ Delete the test record from database
2. ✅ Update all code files (I'll provide these)
3. ✅ Test the web interface
4. ✅ Set up PM2 for auto-restart
5. ✅ Configure Nginx reverse proxy
6. ✅ Set up SSL certificate

## Summary: PostgreSQL vs MySQL Changes

| Feature | PostgreSQL/PostGIS | MySQL |
|---------|-------------------|-------|
| Spatial Extension | PostGIS | Built-in (5.7+) |
| Geometry Storage | `GEOMETRY(Point, 4326)` | `latitude`, `longitude` columns |
| Get Coordinates | `ST_X(geom)`, `ST_Y(geom)` | Direct column access |
| Create Point | `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` | Insert lat/lng directly |
| Query Placeholders | `$1, $2, $3` | `?, ?, ?` |
| Result Format | `result.rows` | `result[0]` |
| Package | `pg` | `mysql2` |

Ready to proceed? I'll create the updated code files for you next!

