# Hostinger MySQL Deployment - Complete Summary

## 🎯 What You Need to Do

You're on **Hostinger Shared Hosting** which doesn't support PostgreSQL. You need to use **MySQL** instead.

## 📚 Files I Created for You

### 1. **MYSQL_SETUP_STEPS.md** ⭐ START HERE
   - Step-by-step instructions
   - Quick checklist format
   - This is your main guide!

### 2. **MYSQL_MIGRATION_GUIDE.md**
   - Detailed explanation of all changes
   - Troubleshooting guide
   - PostgreSQL vs MySQL comparison

### 3. **db.mysql.sql**
   - MySQL database schema
   - Run this in phpMyAdmin to create tables
   - Includes test data

### 4. **config/database.mysql.js**
   - MySQL connection configuration
   - Replace your current `config/database.js` with this

### 5. **routes/api.mysql.js**
   - MySQL-compatible API routes
   - Replace your current `routes/api.js` with this

### 6. **test-mysql-connection.js**
   - Test script to verify database connection
   - Run before starting your app

### 7. **.env.mysql.example**
   - Template for your .env file
   - Shows correct format for Hostinger

## 🚀 Quick Start (5 Minutes)

### Step 1: Create Database (2 min)
1. Login to Hostinger hPanel
2. Go to Databases → MySQL Databases
3. Create database: `noisewatch`
4. Create user: `noisewatch_user` with password
5. Add user to database with ALL PRIVILEGES
6. **Note the full names** (they'll have a prefix like `u734807911_`)

### Step 2: Create Tables (1 min)
1. Open phpMyAdmin from hPanel
2. Select your database
3. Click SQL tab
4. Copy/paste contents of `db.mysql.sql`
5. Click Go

### Step 3: Update Code (2 min)
```bash
# SSH into your server
cd /home/u734807911/noisewatch

# Install MySQL package
npm install mysql2

# Update .env file
nano .env
# Add your MySQL credentials (see .env.mysql.example)

# Backup and replace files
cp config/database.js config/database.postgres.backup.js
cp routes/api.js routes/api.postgres.backup.js
cp config/database.mysql.js config/database.js
cp routes/api.mysql.js routes/api.js

# Test connection
node test-mysql-connection.js

# Start app
pm2 restart noisewatch
# or
node app.js
```

## 🔑 Key Differences: PostgreSQL → MySQL

| What | PostgreSQL | MySQL |
|------|-----------|-------|
| **Package** | `pg` | `mysql2` |
| **Spatial** | PostGIS extension | Built-in (5.7+) |
| **Coordinates** | `GEOMETRY(Point, 4326)` | `latitude`, `longitude` columns |
| **Get Lat/Lng** | `ST_X(geom)`, `ST_Y(geom)` | Direct column access |
| **Insert Point** | `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` | Insert lat/lng directly |
| **Placeholders** | `$1, $2, $3` | `?, ?, ?` |
| **Results** | `result.rows` | `result[0]` |
| **Time Interval** | `INTERVAL '24 hours'` | `INTERVAL 24 HOUR` |

## ⚠️ Important Notes

### Database Names on Hostinger
Hostinger **automatically prefixes** database names and usernames with your account ID.

**Example:**
- You create database: `noisewatch`
- Hostinger creates: `u734807911_noisewatch`
- You create user: `noisewatch_user`
- Hostinger creates: `u734807911_noisewatch_user`

**You MUST use the full prefixed names in your .env file!**

### Your .env File Should Look Like:
```env
DB_HOST=localhost
DB_USER=u734807911_noisewatch_user    ← Full name with prefix!
DB_PASSWORD=your_password
DB_DATABASE=u734807911_noisewatch     ← Full name with prefix!
DB_PORT=3306
NODE_ENV=production
PORT=3000
GOOGLE_MAPS_API_KEY=your_key_here
```

## 🐛 Common Errors & Solutions

### "ECONNREFUSED" Error
**Cause:** Can't connect to database
**Solution:** 
- Check DB_HOST is `localhost`
- Check DB_PORT is `3306`
- Verify MySQL is running (it should be on Hostinger)

### "Access denied for user" Error
**Cause:** Wrong username or password
**Solution:**
- Use FULL username with prefix: `u734807911_noisewatch_user`
- Double-check password
- Verify user was added to database in hPanel

### "Unknown database" Error
**Cause:** Database doesn't exist or wrong name
**Solution:**
- Use FULL database name with prefix: `u734807911_noisewatch`
- Verify database exists in phpMyAdmin

### "Cannot find module 'mysql2'" Error
**Cause:** Package not installed
**Solution:**
```bash
cd /home/u734807911/noisewatch
npm install mysql2
```

### "Table 'reports' doesn't exist" Error
**Cause:** Database tables not created
**Solution:**
- Run `db.mysql.sql` in phpMyAdmin

## ✅ Testing Checklist

After setup, verify everything works:

```bash
# 1. Test database connection
node test-mysql-connection.js
# Should show: ✅ All tests passed!

# 2. Start application
pm2 start app.js --name noisewatch

# 3. Check logs
pm2 logs noisewatch
# Should show: ✅ Connected to MySQL database

# 4. Test API
curl http://localhost:3000/api/reports
# Should return JSON array of reports

# 5. Test in browser
# Visit: http://your-domain.com
# Visit: http://your-domain.com/map
# Visit: http://your-domain.com/report
```

## 📞 Need Help?

### Check These First:
1. **Application logs:** `pm2 logs noisewatch`
2. **Database connection:** `node test-mysql-connection.js`
3. **Browser console:** F12 → Console tab
4. **API response:** `curl http://localhost:3000/api/reports`

### Common Issues:
- **Map not loading?** Check GOOGLE_MAPS_API_KEY in .env
- **Can't submit reports?** Check browser console for errors
- **No data showing?** Check if database has records in phpMyAdmin
- **App won't start?** Check PM2 logs for errors

## 🎉 Success Indicators

You'll know it's working when:
- ✅ `test-mysql-connection.js` shows all tests passed
- ✅ `pm2 logs` shows "Connected to MySQL database"
- ✅ Website loads without errors
- ✅ Map displays correctly
- ✅ You can submit a noise report
- ✅ Reports appear on the map

## 📁 File Structure After Migration

```
/home/u734807911/noisewatch/
├── .env                          ← Updated with MySQL credentials
├── config/
│   ├── database.js              ← Replaced with MySQL version
│   ├── database.mysql.js        ← MySQL version (backup)
│   └── database.postgres.backup.js ← Original (backup)
├── routes/
│   ├── api.js                   ← Replaced with MySQL version
│   ├── api.mysql.js             ← MySQL version (backup)
│   └── api.postgres.backup.js   ← Original (backup)
├── db.mysql.sql                 ← MySQL schema
├── test-mysql-connection.js     ← Test script
└── node_modules/
    └── mysql2/                  ← New package
```

## 🔄 Rollback (If Needed)

If something goes wrong and you need to go back to PostgreSQL:

```bash
# Restore original files
cp config/database.postgres.backup.js config/database.js
cp routes/api.postgres.backup.js routes/api.js

# Restart app
pm2 restart noisewatch
```

## 📖 Documentation Order

Read in this order:
1. **HOSTINGER_MYSQL_SUMMARY.md** (this file) - Overview
2. **MYSQL_SETUP_STEPS.md** - Step-by-step instructions
3. **MYSQL_MIGRATION_GUIDE.md** - Detailed guide (if you need more info)

## 🎯 Next Steps After MySQL Works

1. ✅ Get MySQL working (follow MYSQL_SETUP_STEPS.md)
2. ✅ Test the application thoroughly
3. ✅ Set up Nginx reverse proxy (if needed)
4. ✅ Configure SSL certificate with Let's Encrypt
5. ✅ Set up database backups
6. ✅ Monitor with PM2

---

**Ready to start?** Open `MYSQL_SETUP_STEPS.md` and follow the checklist!

