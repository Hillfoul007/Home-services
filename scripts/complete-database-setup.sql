-- Complete database setup including users and providers with proper relationships
-- Run this in Supabase SQL Editor to set up everything properly

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_type enum
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('customer', 'provider', 'rider');

EXCEPTION WHEN duplicate_object THEN NULL;

END $$;

-- Create booking_status enum
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    user_type user_type DEFAULT 'customer',
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create providers table with proper foreign key
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

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    vehicle_type VARCHAR(100),
    license_number VARCHAR(100),
    is_online BOOLEAN DEFAULT FALSE,
    current_location TEXT,
    coordinates JSONB,
    rating DECIMAL(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    completed_deliveries INTEGER DEFAULT 0 CHECK (completed_deliveries >= 0),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

-- Foreign key constraint
CONSTRAINT fk_riders_user_id
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    provider_id UUID,
    rider_id UUID,
    service_type VARCHAR(255) NOT NULL,
    services TEXT[] NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    coordinates JSONB,
    additional_details TEXT,
    status booking_status DEFAULT 'pending',
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price > 0),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

-- Foreign key constraints
CONSTRAINT fk_bookings_customer_id
        FOREIGN KEY (customer_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_bookings_provider_id
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_bookings_rider_id
        FOREIGN KEY (rider_id)
        REFERENCES riders(id)
        ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

CREATE INDEX IF NOT EXISTS idx_users_type ON users (user_type);

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers (user_id);

CREATE INDEX IF NOT EXISTS idx_providers_status ON providers (status);

CREATE INDEX IF NOT EXISTS idx_providers_rating ON providers (rating);

CREATE INDEX IF NOT EXISTS idx_providers_services ON providers USING GIN (services);

CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders (user_id);

CREATE INDEX IF NOT EXISTS idx_riders_online ON riders (is_online);

CREATE INDEX IF NOT EXISTS idx_riders_status ON riders (status);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings (provider_id);

CREATE INDEX IF NOT EXISTS idx_bookings_rider ON bookings (rider_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY IF NOT EXISTS "Service role full access users" ON users FOR ALL USING (
    current_setting ('role') = 'service_role'
);

CREATE POLICY IF NOT EXISTS "Service role full access providers" ON providers FOR ALL USING (
    current_setting ('role') = 'service_role'
);

CREATE POLICY IF NOT EXISTS "Service role full access riders" ON riders FOR ALL USING (
    current_setting ('role') = 'service_role'
);

CREATE POLICY IF NOT EXISTS "Service role full access bookings" ON bookings FOR ALL USING (
    current_setting ('role') = 'service_role'
);

CREATE POLICY IF NOT EXISTS "Anyone can view approved providers" ON providers FOR
SELECT USING (status = 'approved');

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Insert demo data
INSERT INTO
    users (
        id,
        email,
        password_hash,
        full_name,
        phone,
        user_type,
        email_verified
    )
VALUES (
        '123e4567-e89b-12d3-a456-426614174000',
        'demo@example.com',
        '$2b$12$DEMO_BCRYPT_HASH_PLACEHOLDER_FOR_PASSWORD123',
        'Demo Customer',
        '+1234567890',
        'customer',
        true
    ),
    (
        '123e4567-e89b-12d3-a456-426614174001',
        'provider@demo.com',
        '$2b$12$DEMO_BCRYPT_HASH_PLACEHOLDER_FOR_PASSWORD123',
        'Demo Provider',
        '+1234567891',
        'provider',
        true
    ),
    (
        '123e4567-e89b-12d3-a456-426614174002',
        'rider@demo.com',
        '$2b$12$DEMO_BCRYPT_HASH_PLACEHOLDER_FOR_PASSWORD123',
        'Demo Rider',
        '+1234567892',
        'rider',
        true
    ) ON CONFLICT (email) DO NOTHING;

-- Insert demo providers
INSERT INTO providers (user_id, services, hourly_rate, bio, status, rating, completed_jobs) VALUES
('123e4567-e89b-12d3-a456-426614174001', ARRAY['House Cleaning', 'Furniture Assembly'], 25.00, 'Professional service provider with 5 years experience', 'approved', 4.8, 156)
ON CONFLICT DO NOTHING;

-- Insert demo rider
INSERT INTO
    riders (
        user_id,
        is_online,
        current_location,
        coordinates,
        status
    )
VALUES (
        '123e4567-e89b-12d3-a456-426614174002',
        true,
        'Connaught Place, New Delhi',
        '{"lat": 28.6315, "lng": 77.2167}',
        'approved'
    ) ON CONFLICT DO NOTHING;

-- Test the relationships work
SELECT
    'Database setup complete!' as message,
    (
        SELECT COUNT(*)
        FROM users
    ) as user_count,
    (
        SELECT COUNT(*)
        FROM providers
    ) as provider_count,
    (
        SELECT COUNT(*)
        FROM riders
    ) as rider_count;

-- Test provider-user relationship
SELECT p.id, p.services, p.hourly_rate, u.full_name, u.email
FROM providers p
    JOIN users u ON p.user_id = u.id
WHERE
    p.status = 'approved';
