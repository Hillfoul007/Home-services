-- Quick fix for "relation public.users does not exist" error
-- Run this in Supabase SQL Editor immediately

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('customer', 'provider', 'rider');

EXCEPTION WHEN duplicate_object THEN null;

END $$;

-- Create users table with all necessary columns
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

-- Create password_resets table for forgot password functionality
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES users (id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP
    WITH
        TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Create essential RLS policies
CREATE POLICY IF NOT EXISTS "Service role can access all users" ON users FOR ALL USING (
    current_setting ('role') = 'service_role'
);

CREATE POLICY IF NOT EXISTS "Service role can access all password resets" ON password_resets FOR ALL USING (
    current_setting ('role') = 'service_role'
);

-- Create essential functions for email/phone validation
CREATE OR REPLACE FUNCTION check_duplicate_email(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE LOWER(email) = LOWER(email_to_check)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_duplicate_phone(phone_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE phone = phone_to_check
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user registration function
CREATE OR REPLACE FUNCTION register_user(
    p_email TEXT,
    p_password_hash TEXT,
    p_full_name TEXT,
    p_phone TEXT,
    p_user_type user_type DEFAULT 'customer'
)
RETURNS TABLE(success BOOLEAN, message TEXT, user_id UUID) AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check for duplicate email (case-insensitive)
    IF check_duplicate_email(p_email) THEN
        RETURN QUERY SELECT false, 'Email address already exists', NULL::UUID;
        RETURN;
    END IF;

    -- Check for duplicate phone
    IF check_duplicate_phone(p_phone) THEN
        RETURN QUERY SELECT false, 'Phone number already exists', NULL::UUID;
        RETURN;
    END IF;

    -- Insert new user
    INSERT INTO users (email, password_hash, full_name, phone, user_type)
    VALUES (LOWER(p_email), p_password_hash, p_full_name, p_phone, p_user_type)
    RETURNING id INTO new_user_id;

    RETURN QUERY SELECT true, 'User registered successfully', new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create password reset function
CREATE OR REPLACE FUNCTION create_password_reset(p_email TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, token TEXT) AS $$
DECLARE
    user_id_found UUID;
    reset_token TEXT;
BEGIN
    -- Find user by email
    SELECT id INTO user_id_found
    FROM users
    WHERE LOWER(email) = LOWER(p_email);

    IF user_id_found IS NULL THEN
        RETURN QUERY SELECT false, 'Email not found', NULL::TEXT;
        RETURN;
    END IF;

    -- Generate reset token
    reset_token := encode(gen_random_bytes(32), 'hex');

    -- Insert new reset token
    INSERT INTO password_resets (user_id, token, expires_at)
    VALUES (user_id_found, reset_token, NOW() + INTERVAL '1 hour');

    RETURN QUERY SELECT true, 'Password reset token created', reset_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT
EXECUTE ON FUNCTION check_duplicate_email (TEXT) TO anon,
authenticated,
service_role;

GRANT
EXECUTE ON FUNCTION check_duplicate_phone (TEXT) TO anon,
authenticated,
service_role;

GRANT
EXECUTE ON FUNCTION register_user (
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    user_type
) TO anon,
authenticated,
service_role;

GRANT
EXECUTE ON FUNCTION create_password_reset (TEXT) TO anon,
authenticated,
service_role;

-- Insert demo user for testing
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
        '$2b$12$DEMO_BCRYPT_HASH_PLACEHOLDER_GENERIC',
        'Demo User',
        '+1234567890',
        'customer',
        true
    ) ON CONFLICT (email) DO NOTHING;
