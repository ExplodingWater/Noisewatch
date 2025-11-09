# Quick MySQL Setup Steps for Hostinger

Follow these steps **in order** to migrate from PostgreSQL to MySQL.

## ✅ Step 1: Create MySQL Database in Hostinger hPanel

1. Log into Hostinger → Go to **hPanel**
2. Click **Databases** → **MySQL Databases**
3. Click **"Create New Database"**
   - Database name: `noisewatch`
   - Note: Hostinger will prefix it (e.g., `u734807911_noisewatch`)
4. Click **"Create New User"**
   - Username: `noisewatch_user`
   - Password: (create a strong password)
   - Note: Hostinger will prefix it (e.g., `u734807911_noisewatch_user`)
5. **Add User to Database**
   - Select user and database
   - Grant **ALL PRIVILEGES**

**Write down your credentials:**
```
Database: u734807911_noisewatch
Username: u734807911_noisewatch_user
Password: [your password]
Host: localhost
Port: 3306
```

## ✅ Step 2: Create Database Tables

1. In hPanel, go to **Databases** → **phpMyAdmin**
2. Click on your database name in the left sidebar
3. Click the **SQL** tab
4. Copy the contents of `db.mysql.sql` file
5. Paste into the SQL box
6. Click **Go**
7. You should see: "1 row affected" (test record inserted)

## ✅ Step 3: Install MySQL Package (SSH)

```bash
cd /home/u734807911/noisewatch
npm install mysql2
```

## ✅ Step 4: Update .env File

```bash
nano .env
```

Update with your MySQL credentials (use the FULL names with prefix):

```env
DB_HOST=localhost
DB_USER=u734807911_noisewatch_user
DB_PASSWORD=your_actual_password_here
DB_DATABASE=u734807911_noisewatch
DB_PORT=3306

NODE_ENV=production
PORT=3000

GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Save: `Ctrl+X`, then `Y`, then `Enter`

## ✅ Step 5: Backup and Replace Code Files

```bash
# Backup original files
cp config/database.js config/database.postgres.backup.js
cp routes/api.js routes/api.postgres.backup.js

# Replace with MySQL versions
cp config/database.mysql.js config/database.js
cp routes/api.mysql.js routes/api.js
```

## ✅ Step 6: Test Database Connection

```bash
node test-mysql-connection.js
```

**Expected output:**
```
✅ Connected to MySQL successfully!
✅ MySQL Version: 8.0.x
✅ Tables found: 1
   - reports
✅ Reports in database: 1
✅ All tests passed!
```

**If you see errors**, the script will tell you what's wrong.

## ✅ Step 7: Start Your Application

### Option A: Using PM2 (Recommended)

```bash
# Install PM2 if not already installed
npm install -g pm2

# Stop old process if running
pm2 stop noisewatch
pm2 delete noisewatch

# Start with MySQL
pm2 start app.js --name noisewatch

# Check status
pm2 status

# View logs
pm2 logs noisewatch
```

### Option B: Direct Node

```bash
node app.js
```

## ✅ Step 8: Test the Application

### Test in Browser:
```
http://your-domain.com
http://your-domain.com/map
http://your-domain.com/report
```

### Test API with curl:

```bash
# Get all reports
curl http://localhost:3000/api/reports

# Create a test report
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 41.3275,
    "longitude": 19.8187,
    "decibels": 75,
    "description": "Test noise from construction"
  }'

# Get stats
curl http://localhost:3000/api/reports/stats
```

## ✅ Step 9: Delete Test Records (Optional)

Once everything works, delete the test records:

1. Go to phpMyAdmin
2. Click on `reports` table
3. Click **Browse**
4. Check the test records
5. Click **Delete**

Or via SQL:
```sql
DELETE FROM reports WHERE description LIKE 'Test%';
```

## 🔧 Troubleshooting

### Error: "Cannot find module 'mysql2'"
```bash
cd /home/u734807911/noisewatch
npm install mysql2
```

### Error: "Access denied for user"
- Check that DB_USER includes the prefix: `u734807911_noisewatch_user`
- Verify password is correct in .env
- Make sure user was added to database in hPanel

### Error: "Unknown database"
- Check that DB_DATABASE includes the prefix: `u734807911_noisewatch`
- Verify database exists in phpMyAdmin

### Error: "Table 'reports' doesn't exist"
- Run the `db.mysql.sql` script in phpMyAdmin

### Application starts but no data shows
- Check browser console for errors
- Check PM2 logs: `pm2 logs noisewatch`
- Verify API endpoint: `curl http://localhost:3000/api/reports`

## 📋 Checklist

- [ ] MySQL database created in hPanel
- [ ] MySQL user created and added to database
- [ ] Database tables created (db.mysql.sql)
- [ ] mysql2 package installed
- [ ] .env file updated with MySQL credentials
- [ ] config/database.js replaced with MySQL version
- [ ] routes/api.js replaced with MySQL version
- [ ] Connection test passed (test-mysql-connection.js)
- [ ] Application started successfully
- [ ] Can view reports in browser
- [ ] Can submit new reports
- [ ] Test records deleted

## 🎉 Success!

If all steps passed, your Noisewatch application is now running on MySQL!

## Next Steps

1. **Set up Nginx reverse proxy** (if not already done)
2. **Configure SSL certificate** with Let's Encrypt
3. **Set up automatic backups** for your MySQL database
4. **Monitor application** with PM2

## Files Created for MySQL Migration

- `db.mysql.sql` - MySQL database schema
- `config/database.mysql.js` - MySQL connection pool
- `routes/api.mysql.js` - MySQL-compatible API routes
- `test-mysql-connection.js` - Connection test script
- `MYSQL_MIGRATION_GUIDE.md` - Detailed migration guide
- `MYSQL_SETUP_STEPS.md` - This quick setup guide

## Backup Files (for rollback if needed)

- `config/database.postgres.backup.js` - Original PostgreSQL config
- `routes/api.postgres.backup.js` - Original PostgreSQL routes

Need help? Check the detailed `MYSQL_MIGRATION_GUIDE.md` file!

