-- IMMEDIATE FIX for "relation public.users does not exist" error
-- Run this in Supabase SQL Editor RIGHT NOW to fix the error

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_type enum
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('customer', 'provider', 'rider');

EXCEPTION WHEN duplicate_object THEN NULL;

END $$;

-- Create users table immediately
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

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create basic policy for service role
CREATE POLICY IF NOT EXISTS "Service role full access" ON users FOR ALL USING (
    current_setting ('role') = 'service_role'
);

-- Grant permissions
GRANT ALL ON users TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;

-- Insert demo user for immediate testing
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
        'Demo User',
        '+1234567890',
        'customer',
        true
    ),
    (
        '123e4567-e89b-12d3-a456-426614174001',
        'rider@demo.com',
        '$2b$12$DEMO_BCRYPT_HASH_PLACEHOLDER_FOR_PASSWORD123',
        'Demo Rider',
        '+1234567891',
        'rider',
        true
    ) ON CONFLICT (email) DO NOTHING;

-- Test the table
SELECT 'Users table created successfully!' as message, COUNT(*) as user_count
FROM users;
