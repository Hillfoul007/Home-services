-- Quick fix for missing providers table
-- Run this in Supabase SQL Editor if you get "providers does not exist" error

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create providers table if it doesn't exist
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    services TEXT[] NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    bio TEXT,
    experience_years INTEGER DEFAULT 0,
    availability TEXT,
    certifications TEXT,
    rating DECIMAL(3,2) DEFAULT 0,
    completed_jobs INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for providers table
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers (user_id);

CREATE INDEX IF NOT EXISTS idx_providers_status ON providers (status);

CREATE INDEX IF NOT EXISTS idx_providers_rating ON providers (rating);

-- Add RLS policies for providers
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all providers
CREATE POLICY IF NOT EXISTS "Service role can access all providers" ON providers FOR ALL USING (
    current_setting ('role') = 'service_role'
);

-- Allow authenticated users to view approved providers
CREATE POLICY IF NOT EXISTS "Anyone can view approved providers" ON providers FOR
SELECT USING (status = 'approved');

-- Allow providers to view and update their own data
CREATE POLICY IF NOT EXISTS "Providers can view own data" 
ON providers FOR SELECT 
USING (
    CASE WHEN current_setting('role') = 'authenticated' THEN 
        user_id::text = auth.uid()::text 
    ELSE false END
);

CREATE POLICY IF NOT EXISTS "Providers can update own data" 
ON providers FOR UPDATE 
USING (
    CASE WHEN current_setting('role') = 'authenticated' THEN 
        user_id::text = auth.uid()::text 
    ELSE false END
);

-- Insert demo provider if users exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE email = 'provider@demo.com') THEN
        INSERT INTO providers (user_id, services, hourly_rate, bio, status) 
        SELECT id, ARRAY['House Cleaning', 'Furniture Assembly'], 25.00, 'Professional service provider with 5 years experience', 'approved'
        FROM users 
        WHERE email = 'provider@demo.com'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Create trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for providers table
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;

CREATE TRIGGER update_providers_updated_at 
    BEFORE UPDATE ON providers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();