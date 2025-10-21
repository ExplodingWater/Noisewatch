# Noisewatch Deployment Guide

## Prerequisites

- Node.js (version 16 or higher)
- PostgreSQL database with PostGIS extension
- Domain name and hosting service

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=your_database_host
DB_PORT=5432
DB_DATABASE=noisewatch
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# Server Configuration
PORT=3000
NODE_ENV=production

# For production, you might also need:
DATABASE_URL=postgresql://username:password@host:port/database
```

## Database Setup

1. Create a PostgreSQL database
2. Enable the PostGIS extension:
   ```sql
   CREATE EXTENSION postgis;
   ```
3. Run the database schema:
   ```bash
   psql -d your_database -f db.sql
   ```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. The application will be available at `http://localhost:3000`

## Production Deployment

### Option 1: Traditional VPS/Server

1. Clone the repository to your server
2. Install dependencies:
   ```bash
   npm install --production
   ```
3. Set up environment variables
4. Set up the database
5. Start the application:
   ```bash
   npm start
   ```

### Option 2: Platform as a Service (PaaS)

#### Heroku
1. Create a Heroku app
2. Add PostgreSQL addon
3. Set environment variables in Heroku dashboard
4. Deploy using Git:
   ```bash
   git push heroku main
   ```

#### Railway
1. Connect your GitHub repository
2. Add PostgreSQL service
3. Set environment variables
4. Deploy automatically

#### DigitalOcean App Platform
1. Connect your repository
2. Configure environment variables
3. Add PostgreSQL database
4. Deploy

### Option 3: Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t noisewatch .
docker run -p 3000:3000 --env-file .env noisewatch
```

## Domain Configuration

1. Point your domain to your server's IP address
2. Configure SSL certificate (Let's Encrypt recommended)
3. Set up reverse proxy (nginx recommended) if needed

## Monitoring and Maintenance

- Set up process monitoring (PM2 recommended for Node.js)
- Configure log rotation
- Set up database backups
- Monitor server resources

## Security Considerations

- Use environment variables for sensitive data
- Enable HTTPS in production
- Configure CORS appropriately
- Regular security updates
- Database connection security

## Performance Optimization

- Enable gzip compression
- Set up CDN for static assets
- Database query optimization
- Caching strategies

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check database credentials
   - Ensure PostgreSQL is running
   - Verify PostGIS extension is installed

2. **Static Files Not Loading**
   - Check file paths in HTML files
   - Verify static file middleware configuration

3. **API Endpoints Not Working**
   - Check route configuration
   - Verify CORS settings
   - Check request/response format

### Logs

Check application logs for errors:
```bash
# If using PM2
pm2 logs

# If using systemd
journalctl -u your-service-name
```

## Support

For deployment issues, check:
- Application logs
- Database logs
- Server logs
- Network connectivity

Contact the development team for additional support.
