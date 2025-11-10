-- This script sets up the 'reports' table in your PostgreSQL database.
-- You need to have the 'postgis' extension enabled first.
-- To enable it, run this command once per database: CREATE EXTENSION postgis;
DROP TABLE IF EXISTS reports;

CREATE TABLE reports (
    -- 'id' is the primary key, which automatically increments
    id SERIAL PRIMARY KEY,

    -- 'decibels' stores the noise level as an integer
    decibels INT NOT NULL,

    -- 'description' stores the user's text description
    description VARCHAR(255) NOT NULL,

    -- 'geom' is the GIS column. It stores geographic data.
    -- 'geometry(Point, 4326)' means it will store a Point in the WGS 84 coordinate system (standard GPS).
    geom GEOMETRY(Point, 4326) NOT NULL,

    -- 'submitted_time' records the wall-clock time (HH:MM:SS) of submission
    submitted_time TIME WITHOUT TIME ZONE DEFAULT (CURRENT_TIME),

    -- 'created_at' automatically records when a report was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    , device_info TEXT
    , source VARCHAR(32)
    , accuracy_meters INTEGERz
    , audio_path TEXT
    , severity VARCHAR(16)
);

-- Create a spatial index on the 'geom' column.
-- This is VERY important for making location-based queries fast.
CREATE INDEX reports_geom_idx ON reports USING GIST (geom);

-- You can insert a sample point to test if it's working:
-- INSERT INTO reports (decibels, description, geom)
-- VALUES (85, 'Loud construction', ST_SetSRID(ST_MakePoint(19.8187, 41.3275), 4326));
-- Done with Gemini 2.5 Pro
