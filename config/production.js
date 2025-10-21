// Production configuration
module.exports = {
  database: {
    host: process.env.DB_HOST || process.env.DATABASE_URL,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_DATABASE || 'noisewatch',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
};
