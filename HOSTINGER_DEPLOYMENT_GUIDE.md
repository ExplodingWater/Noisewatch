# Hostinger Deployment Guide for Noisewatch

This guide will walk you through deploying the Noisewatch application on Hostinger VPS/Cloud hosting.

## Prerequisites

- Hostinger VPS or Cloud hosting plan
- SSH access to your server
- Domain name (optional but recommended)

## Part 1: Database Setup

### Step 1: Create PostgreSQL Database

Hostinger typically provides PostgreSQL through their control panel (hPanel) or you need to install it manually on VPS.

#### Option A: Using Hostinger's Database Manager (if available)
1. Log into hPanel
2. Go to "Databases" → "PostgreSQL Databases"
3. Create a new database named `noisewatch`
4. Note down the credentials:
   - Database name
   - Username
   - Password
   - Host (usually `localhost` or an IP address)
   - Port (usually `5432`)

#### Option B: Manual PostgreSQL Installation on VPS
If PostgreSQL is not pre-installed:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL and PostGIS
sudo apt install postgresql postgresql-contrib postgis -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE noisewatch;
CREATE USER noisewatch_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE noisewatch TO noisewatch_user;
\c noisewatch
CREATE EXTENSION postgis;
ALTER DATABASE noisewatch OWNER TO noisewatch_user;
EOF
```

### Step 2: Enable PostGIS Extension

Connect to your database and enable PostGIS:

```bash
# Connect to PostgreSQL
psql -U noisewatch_user -d noisewatch -h localhost

# Inside psql, run:
CREATE EXTENSION IF NOT EXISTS postgis;

# Verify PostGIS is installed
SELECT PostGIS_version();

# Exit psql
\q
```

### Step 3: Run Database Schema

Upload and run the `db.sql` file to create the tables:

```bash
# From your project directory on the server
psql -U noisewatch_user -d noisewatch -h localhost -f db.sql
```

**Important Note:** If you get a connection refused error, you need to configure PostgreSQL to accept connections.

## Part 2: Fixing Database Connection Issues

### Understanding the ECONNREFUSED Error

The error you're seeing means PostgreSQL is either:
1. Not running
2. Not accepting connections on the expected host/port
3. Configured to only accept local socket connections

### Solution 1: Check PostgreSQL Status

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it
sudo systemctl start postgresql
```

### Solution 2: Configure PostgreSQL to Accept TCP Connections

Edit PostgreSQL configuration:

```bash
# Find your PostgreSQL version
psql --version

# Edit postgresql.conf (adjust path for your version)
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and uncomment/modify this line:
listen_addresses = 'localhost'

# Save and exit (Ctrl+X, Y, Enter)

# Edit pg_hba.conf to allow password authentication
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add this line (or modify existing):
host    all             all             127.0.0.1/32            md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Solution 3: Update Your .env File

Create or update your `.env` file in the project root:

```bash
# Navigate to your project directory
cd /home/u734807911/noisewatch

# Create/edit .env file
nano .env
```

Add these environment variables (adjust values to match your setup):

```env
# Database Configuration
DB_USER=noisewatch_user
DB_HOST=localhost
DB_DATABASE=noisewatch
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Application Configuration
NODE_ENV=production
PORT=3000

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Important:** Make sure the `.env` file has proper permissions:

```bash
chmod 600 .env
```

### Solution 4: Test Database Connection

Before running migrations, test the connection:

```bash
# Test with psql
psql -U noisewatch_user -d noisewatch -h localhost -p 5432

# If successful, you'll see the psql prompt
# Exit with \q
```

If this works, your database is accessible and the issue is with your Node.js configuration.

### Solution 5: Run Migration Again

Now try running the migration:

```bash
node scripts/run_migration.js
```

## Part 3: Application Deployment

### Step 1: Upload Your Code

If you haven't already, upload your code to the server:

```bash
# Using Git (recommended)
cd /home/u734807911
git clone https://github.com/ExplodingWater/Noisewatch.git noisewatch
cd noisewatch

# Or upload via SFTP/SCP
```

### Step 2: Install Dependencies

```bash
cd /home/u734807911/noisewatch
npm install --production
```

### Step 3: Configure Environment Variables

Ensure your `.env` file is properly configured (see Part 2, Solution 3).

### Step 4: Run the Application

#### Option A: Using PM2 (Recommended for Production)

PM2 keeps your app running and restarts it if it crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start app.js --name noisewatch

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Follow the instructions it provides

# Check status
pm2 status

# View logs
pm2 logs noisewatch
```

#### Option B: Using Node Directly (Not Recommended for Production)

```bash
# Start the app
node app.js

# Or with nohup to keep it running after logout
nohup node app.js > app.log 2>&1 &
```

### Step 5: Configure Reverse Proxy (Nginx)

Most Hostinger VPS plans use Nginx. Configure it to proxy requests to your Node.js app:

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/noisewatch
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/noisewatch /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 6: Set Up SSL (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts
# Certbot will automatically configure Nginx for HTTPS
```

## Part 4: Troubleshooting Common Issues

### Issue 1: Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process if needed
sudo kill -9 <PID>
```

### Issue 2: Permission Denied

```bash
# Fix file permissions
cd /home/u734807911/noisewatch
chmod -R 755 .
chown -R u734807911:u734807911 .
```

### Issue 3: Database Connection Still Failing

Check if PostgreSQL is listening:

```bash
sudo netstat -plnt | grep 5432
```

If you don't see port 5432, PostgreSQL isn't listening on TCP.

### Issue 4: Application Not Starting

Check logs:

```bash
# If using PM2
pm2 logs noisewatch

# If using nohup
tail -f app.log
```

## Part 5: Maintenance Commands

```bash
# Restart application
pm2 restart noisewatch

# Stop application
pm2 stop noisewatch

# View application status
pm2 status

# Monitor application
pm2 monit

# View logs
pm2 logs noisewatch --lines 100
```

## Part 6: Security Checklist

- [ ] PostgreSQL password is strong and secure
- [ ] `.env` file has restricted permissions (600)
- [ ] Firewall is configured (allow only 80, 443, 22)
- [ ] SSH key authentication is enabled
- [ ] PostgreSQL only accepts local connections
- [ ] SSL certificate is installed and auto-renewing
- [ ] Regular backups are configured

## Quick Reference: Your Current Setup

Based on your SSH path, your setup is:
- **User:** u734807911
- **Project Path:** `/home/u734807911/noisewatch`
- **Database:** Needs configuration (see Part 1 & 2)

## Next Steps After Fixing Database Connection

1. ✅ Fix database connection (Part 2)
2. ✅ Run migration: `node scripts/run_migration.js`
3. ✅ Start application with PM2
4. ✅ Configure Nginx reverse proxy
5. ✅ Set up SSL certificate
6. ✅ Test the application

## Support

If you continue to have issues, check:
- Hostinger's documentation for your specific hosting plan
- PostgreSQL logs: `/var/log/postgresql/postgresql-*.log`
- Nginx logs: `/var/log/nginx/error.log`
- Application logs: `pm2 logs noisewatch`

