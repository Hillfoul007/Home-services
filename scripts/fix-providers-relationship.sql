-- Fix providers table and relationship with users table
-- Run this in Supabase SQL Editor to fix the relationship error

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create providers table if it doesn't exist
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    services TEXT[] NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL CHECK (hourly_rate > 0),
    bio TEXT,
    experience_years INTEGER DEFAULT 0 CHECK (experience_years >= 0),
    availability TEXT,
    certifications TEXT,
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    completed_jobs INTEGER DEFAULT 0 CHECK (completed_jobs >= 0),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

-- Foreign key constraint
CONSTRAINT fk_providers_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,

-- Constraints
CONSTRAINT valid_services CHECK (array_length(services, 1) > 0) );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers (user_id);

CREATE INDEX IF NOT EXISTS idx_providers_status ON providers (status);

CREATE INDEX IF NOT EXISTS idx_providers_rating ON providers (rating);

CREATE INDEX IF NOT EXISTS idx_providers_services ON providers USING GIN (services);

-- Enable RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Service role can access all providers" ON providers FOR ALL USING (
    current_setting ('role') = 'service_role'
);

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

CREATE POLICY IF NOT EXISTS "Anyone can view approved providers" ON providers FOR
SELECT USING (status = 'approved');

-- Grant permissions
GRANT ALL ON providers TO service_role;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;

CREATE TRIGGER update_providers_updated_at 
    BEFORE UPDATE ON providers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert demo provider if users exist
DO $$
BEGIN
    -- Check if demo provider user exists
    IF EXISTS (SELECT 1 FROM users WHERE email = 'provider@demo.com') THEN
        -- Insert demo provider if not exists
        INSERT INTO providers (user_id, services, hourly_rate, bio, status, rating, completed_jobs) 
        SELECT 
            u.id, 
            ARRAY['House Cleaning', 'Furniture Assembly'], 
            25.00, 
            'Professional service provider with 5 years experience', 
            'approved',
            4.8,
            156
        FROM users u 
        WHERE u.email = 'provider@demo.com'
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Check if another demo user exists to create second provider
    IF EXISTS (SELECT 1 FROM users WHERE email = 'demo@example.com') THEN
        INSERT INTO providers (user_id, services, hourly_rate, bio, status, rating, completed_jobs) 
        SELECT 
            u.id, 
            ARRAY['Home Repair', 'Moving Service'], 
            30.00, 
            'Experienced handyman and moving specialist', 
            'approved',
            4.9,
            89
        FROM users u 
        WHERE u.email = 'demo@example.com'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Verify the relationship works
SELECT p.id, p.services, p.hourly_rate, p.status, u.full_name, u.email
FROM providers p
    JOIN users u ON p.user_id = u.id
WHERE
    p.status = 'approved'
LIMIT 5;

-- Success message
SELECT 'Providers table and relationship created successfully!' as message;