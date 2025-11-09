#!/usr/bin/env node
/**
 * Test MySQL Database Connection
 * Run this to verify your MySQL credentials are correct before starting the app
 * 
 * Usage: node test-mysql-connection.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('🔍 Testing MySQL connection...\n');
  
  // Display configuration (hide password)
  console.log('Configuration:');
  console.log('  Host:', process.env.DB_HOST || 'localhost');
  console.log('  User:', process.env.DB_USER || '(not set)');
  console.log('  Database:', process.env.DB_DATABASE || '(not set)');
  console.log('  Port:', process.env.DB_PORT || 3306);
  console.log('  Password:', process.env.DB_PASSWORD ? '***' : '(not set)');
  console.log('');

  try {
    // Attempt to create connection
    console.log('📡 Connecting to MySQL...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('✅ Connected to MySQL successfully!\n');
    
    // Test query: Get MySQL version
    console.log('📊 Testing query: SELECT VERSION()');
    const [versionRows] = await connection.execute('SELECT VERSION() as version');
    console.log('✅ MySQL Version:', versionRows[0].version);
    console.log('');
    
    // Test query: Check if reports table exists
    console.log('📊 Testing query: SHOW TABLES');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('✅ Tables found:', tables.length);
    tables.forEach(table => {
      console.log('   -', Object.values(table)[0]);
    });
    console.log('');
    
    // Test query: Get reports count
    console.log('📊 Testing query: SELECT COUNT(*) FROM reports');
    const [countRows] = await connection.execute('SELECT COUNT(*) as count FROM reports');
    console.log('✅ Reports in database:', countRows[0].count);
    console.log('');
    
    // Test query: Get sample report
    if (countRows[0].count > 0) {
      console.log('📊 Testing query: SELECT * FROM reports LIMIT 1');
      const [sampleRows] = await connection.execute('SELECT * FROM reports LIMIT 1');
      console.log('✅ Sample report:');
      console.log(JSON.stringify(sampleRows[0], null, 2));
      console.log('');
    }
    
    // Close connection
    await connection.end();
    console.log('✅ All tests passed! Your MySQL database is ready.\n');
    console.log('You can now start your application with:');
    console.log('  node app.js');
    console.log('  or');
    console.log('  pm2 start app.js --name noisewatch');
    
  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.error('');
    
    // Provide helpful error messages
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 This error means your username or password is incorrect.');
      console.error('   Check your .env file and verify:');
      console.error('   - DB_USER includes the Hostinger prefix (e.g., u734807911_noisewatch_user)');
      console.error('   - DB_PASSWORD is correct');
      console.error('   - User has been added to the database in hPanel');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 This error means the database does not exist.');
      console.error('   Check your .env file and verify:');
      console.error('   - DB_DATABASE includes the Hostinger prefix (e.g., u734807911_noisewatch)');
      console.error('   - Database was created in hPanel');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 This error means MySQL is not accepting connections.');
      console.error('   Possible causes:');
      console.error('   - MySQL service is not running');
      console.error('   - DB_HOST is incorrect (try "localhost" or "127.0.0.1")');
      console.error('   - DB_PORT is incorrect (default is 3306)');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 This error means the database host cannot be found.');
      console.error('   Check your DB_HOST in .env file');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('💡 The reports table does not exist.');
      console.error('   Run the db.mysql.sql script in phpMyAdmin to create it.');
    }
    
    console.error('');
    process.exit(1);
  }
}

// Run the test
testConnection();

