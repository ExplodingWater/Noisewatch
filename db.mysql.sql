-- MySQL Schema for Noisewatch
-- This replaces the PostgreSQL/PostGIS schema with MySQL-compatible version
-- MySQL 5.7+ has built-in spatial support, no extension needed

-- Drop table if exists
DROP TABLE IF EXISTS reports;

-- Create reports table
CREATE TABLE reports (
    -- Primary key with auto increment
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Noise level in decibels
    decibels INT NOT NULL,
    
    -- User description (max 255 characters)
    description VARCHAR(255) NOT NULL,
    
    -- Latitude and Longitude as separate DECIMAL columns
    -- DECIMAL(10,8) for latitude: range -90.00000000 to 90.00000000
    -- DECIMAL(11,8) for longitude: range -180.00000000 to 180.00000000
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Submission time (wall-clock time HH:MM:SS)
    submitted_time TIME DEFAULT NULL,
    
    -- Timestamp when report was created
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional metadata fields
    device_info TEXT,
    source VARCHAR(32),
    accuracy_meters INT,
    audio_path TEXT,
    severity VARCHAR(16),
    
    -- Indexes for performance
    INDEX idx_location (latitude, longitude),
    INDEX idx_created_at (created_at),
    INDEX idx_severity (severity),
    INDEX idx_decibels (decibels)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: If you want to use MySQL's POINT spatial type (advanced)
-- Uncomment the following to add a spatial column and index:
-- ALTER TABLE reports ADD COLUMN geom POINT NOT NULL SRID 4326;
-- CREATE SPATIAL INDEX idx_geom ON reports(geom);

-- Insert a test record to verify everything works
INSERT INTO reports (decibels, description, latitude, longitude, severity)
VALUES (85, 'Test report - Loud construction near Skanderbeg Square', 41.3275, 19.8187, 'loud');

-- Verify the test record
SELECT id, decibels, description, latitude, longitude, severity, created_at 
FROM reports;

-- Show table structure
DESCRIBE reports;

