-- Ensure riders table exists with all required fields
-- This script can be run safely multiple times

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create rider_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE rider_status AS ENUM ('pending', 'approved', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create riders table if it doesn't exist
CREATE TABLE IF NOT EXISTS riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(100),
    license_number VARCHAR(100),
    is_online BOOLEAN DEFAULT FALSE,
    current_location TEXT,
    coordinates JSONB,
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    completed_deliveries INTEGER DEFAULT 0 CHECK (completed_deliveries >= 0),
    status rider_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add enhanced location columns if they don't exist (from migration 004)
ALTER TABLE riders
ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_location TEXT,
ADD COLUMN IF NOT EXISTS base_coordinates JSONB,
ADD COLUMN IF NOT EXISTS current_coordinates JSONB,
ADD COLUMN IF NOT EXISTS service_radius_km DECIMAL(10,2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS operating_areas TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_services TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS availability_hours JSONB DEFAULT '{"start": "08:00", "end": "20:00"}',
ADD COLUMN IF NOT EXISTS documents JSONB,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_online ON riders(is_online);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);
CREATE INDEX IF NOT EXISTS idx_riders_coordinates ON riders USING GIN (coordinates);
CREATE INDEX IF NOT EXISTS idx_riders_current_coordinates ON riders USING GIN (current_coordinates);
CREATE INDEX IF NOT EXISTS idx_riders_online_location ON riders(is_online, current_coordinates) WHERE is_online = TRUE;

-- Create or update function to update timestamp on location change
CREATE OR REPLACE FUNCTION update_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_coordinates IS DISTINCT FROM NEW.current_coordinates THEN
    NEW.last_location_update = NOW();
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_rider_location_timestamp ON riders;
CREATE TRIGGER trigger_update_rider_location_timestamp
  BEFORE UPDATE ON riders
  FOR EACH ROW
  EXECUTE FUNCTION update_location_timestamp();

-- Verify table structure
DO $$
BEGIN
    -- Check if all expected columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'riders' 
        AND column_name = 'base_coordinates'
    ) THEN
        RAISE NOTICE 'Warning: riders table may not have all enhanced location columns. Run migration 004_create_location_tables.sql';
    ELSE
        RAISE NOTICE 'Success: riders table exists with all required fields';
    END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON riders TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

COMMENT ON TABLE riders IS 'Riders/service providers table with location tracking and enhanced features';
COMMENT ON COLUMN riders.current_coordinates IS 'Real-time GPS coordinates of the rider';
COMMENT ON COLUMN riders.base_coordinates IS 'Home base location coordinates';
COMMENT ON COLUMN riders.service_radius_km IS 'Maximum distance rider will travel for jobs';
