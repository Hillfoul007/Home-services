import pkg from "pg";
const { Client } = pkg;

// Database connection string - should be loaded from environment variables
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.your_project_id:your_password@your_region.pooler.supabase.com:6543/postgres";

async function createRidersTable() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("🔌 Connecting to Supabase database...");
    await client.connect();
    console.log("✅ Connected successfully!");

    console.log("🚀 Creating riders table and related structures...");

    // SQL script to create the complete riders system
    const createRidersSQL = `
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis" CASCADE;

-- Create custom types
DO $$ BEGIN
    CREATE TYPE rider_status AS ENUM ('pending', 'approved', 'active', 'inactive', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Type rider_status already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('bike', 'scooter', 'motorcycle', 'car', 'bicycle', 'on_foot');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Type vehicle_type already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status AS ENUM ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Type delivery_status already exists, skipping...';
END $$;

-- Create riders table
CREATE TABLE IF NOT EXISTS public.riders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Personal Information
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    profile_photo_url TEXT,

    -- Rider-specific Information
    vehicle_type vehicle_type NOT NULL,
    vehicle_model VARCHAR(100),
    vehicle_registration VARCHAR(50),
    license_number VARCHAR(50) NOT NULL,
    license_expiry DATE,

    -- Location & Availability
    is_online BOOLEAN DEFAULT FALSE,
    current_location TEXT,
    current_coordinates JSONB,
    base_location TEXT,
    base_coordinates JSONB,
    service_radius_km DECIMAL(8,2) DEFAULT 10.0 CHECK (service_radius_km > 0),

    -- Working Hours
    working_hours JSONB DEFAULT '{
        "monday": {"start": "09:00", "end": "18:00", "active": true},
        "tuesday": {"start": "09:00", "end": "18:00", "active": true},
        "wednesday": {"start": "09:00", "end": "18:00", "active": true},
        "thursday": {"start": "09:00", "end": "18:00", "active": true},
        "friday": {"start": "09:00", "end": "18:00", "active": true},
        "saturday": {"start": "09:00", "end": "18:00", "active": true},
        "sunday": {"start": "09:00", "end": "18:00", "active": false}
    }',

    -- Performance Metrics
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    total_deliveries INTEGER DEFAULT 0 CHECK (total_deliveries >= 0),
    completed_deliveries INTEGER DEFAULT 0 CHECK (completed_deliveries >= 0),
    cancelled_deliveries INTEGER DEFAULT 0 CHECK (cancelled_deliveries >= 0),
    average_delivery_time INTEGER DEFAULT 0, -- in minutes

    -- Financial Information
    earnings_total DECIMAL(12,2) DEFAULT 0.0 CHECK (earnings_total >= 0),
    earnings_this_month DECIMAL(12,2) DEFAULT 0.0 CHECK (earnings_this_month >= 0),
    commission_rate DECIMAL(5,2) DEFAULT 15.0 CHECK (commission_rate >= 0 AND commission_rate <= 100),

    -- Documents & Verification
    documents JSONB DEFAULT '{
        "drivers_license": {"uploaded": false, "verified": false, "url": null},
        "vehicle_registration": {"uploaded": false, "verified": false, "url": null},
        "insurance": {"uploaded": false, "verified": false, "url": null},
        "background_check": {"uploaded": false, "verified": false, "url": null}
    }',
    verification_status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),

    -- Account Status
    status rider_status DEFAULT 'pending',
    approved_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    last_location_update TIMESTAMP WITH TIME ZONE,

    -- Preferences
    preferred_delivery_types TEXT[] DEFAULT ARRAY['standard', 'express', 'scheduled'],
    max_delivery_distance DECIMAL(8,2) DEFAULT 25.0,
    accepts_cash_payments BOOLEAN DEFAULT TRUE,
    accepts_card_payments BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_phone CHECK (phone ~* '^\\+?[1-9]\\d{1,14}$'),
    CONSTRAINT valid_name CHECK (LENGTH(TRIM(full_name)) >= 2),
    CONSTRAINT valid_rating_calculation CHECK (
        total_deliveries = 0 OR
        (completed_deliveries + cancelled_deliveries) <= total_deliveries
    )
);

-- Create delivery_requests table
CREATE TABLE IF NOT EXISTS public.delivery_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Pickup Information
    pickup_address TEXT NOT NULL,
    pickup_coordinates JSONB NOT NULL,
    pickup_contact_name VARCHAR(255),
    pickup_contact_phone VARCHAR(20),
    pickup_instructions TEXT,

    -- Delivery Information
    delivery_address TEXT NOT NULL,
    delivery_coordinates JSONB NOT NULL,
    delivery_contact_name VARCHAR(255),
    delivery_contact_phone VARCHAR(20),
    delivery_instructions TEXT,

    -- Package Details
    package_description TEXT,
    package_weight DECIMAL(8,2), -- in kg
    package_dimensions JSONB, -- {"length": 0, "width": 0, "height": 0}
    package_value DECIMAL(10,2),
    fragile BOOLEAN DEFAULT FALSE,

    -- Timing
    requested_pickup_time TIMESTAMP WITH TIME ZONE,
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_pickup_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,

    -- Status and Progress
    status delivery_status DEFAULT 'pending',
    delivery_type VARCHAR(20) DEFAULT 'standard' CHECK (delivery_type IN (
        'standard', 'express', 'scheduled', 'same_day'
    )),

    -- Financial
    base_fee DECIMAL(10,2) NOT NULL DEFAULT 5.0 CHECK (base_fee >= 0),
    distance_fee DECIMAL(10,2) DEFAULT 0.0 CHECK (distance_fee >= 0),
    express_fee DECIMAL(10,2) DEFAULT 0.0 CHECK (express_fee >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    rider_earnings DECIMAL(10,2) DEFAULT 0.0 CHECK (rider_earnings >= 0),
    payment_method VARCHAR(20) DEFAULT 'cash',
    payment_status VARCHAR(20) DEFAULT 'pending',

    -- Distance and Route
    distance_km DECIMAL(8,2),
    estimated_duration_minutes INTEGER,
    route_data JSONB,

    -- Tracking
    tracking_number VARCHAR(50) UNIQUE,
    current_location JSONB,
    delivery_proof JSONB, -- photos, signatures, etc.

    -- Ratings and Feedback
    customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
    customer_feedback TEXT,
    rider_rating INTEGER CHECK (rider_rating >= 1 AND rider_rating <= 5),
    rider_feedback TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create rider_earnings table
CREATE TABLE IF NOT EXISTS public.rider_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    delivery_request_id UUID REFERENCES public.delivery_requests(id) ON DELETE SET NULL,

    -- Earning Details
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    earning_type VARCHAR(30) NOT NULL CHECK (earning_type IN (
        'delivery_fee', 'tip', 'bonus', 'incentive', 'adjustment'
    )),
    description TEXT,

    -- Period Information
    earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    week_start DATE,
    month_year VARCHAR(7), -- Format: 2024-01

    -- Payment Status
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_batch_id VARCHAR(100),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON public.riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_status ON public.riders(status);
CREATE INDEX IF NOT EXISTS idx_riders_online ON public.riders(is_online);
CREATE INDEX IF NOT EXISTS idx_riders_location ON public.riders USING GIN (current_coordinates);
CREATE INDEX IF NOT EXISTS idx_riders_base_location ON public.riders USING GIN (base_coordinates);
CREATE INDEX IF NOT EXISTS idx_riders_rating ON public.riders(rating DESC);
CREATE INDEX IF NOT EXISTS idx_riders_vehicle_type ON public.riders(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_riders_service_radius ON public.riders(service_radius_km);
CREATE INDEX IF NOT EXISTS idx_riders_email ON public.riders(email);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_rider ON public.delivery_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_customer ON public.delivery_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON public.delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created_at ON public.delivery_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_pickup_coords ON public.delivery_requests USING GIN (pickup_coordinates);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_delivery_coords ON public.delivery_requests USING GIN (delivery_coordinates);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_tracking ON public.delivery_requests(tracking_number);

CREATE INDEX IF NOT EXISTS idx_rider_earnings_rider ON public.rider_earnings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_date ON public.rider_earnings(earned_date);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_month ON public.rider_earnings(month_year);
CREATE INDEX IF NOT EXISTS idx_rider_earnings_paid ON public.rider_earnings(paid);

-- Create functions for rider operations

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION public.calculate_distance_km(lat1 DECIMAL, lng1 DECIMAL, lat2 DECIMAL, lng2 DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    earth_radius DECIMAL := 6371.0;
    dlat DECIMAL;
    dlng DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby available riders
CREATE OR REPLACE FUNCTION public.find_available_riders(
    pickup_lat DECIMAL,
    pickup_lng DECIMAL,
    max_distance_km DECIMAL DEFAULT 15.0
)
RETURNS TABLE (
    rider_id UUID,
    full_name VARCHAR,
    vehicle_type vehicle_type,
    rating DECIMAL,
    distance_km DECIMAL,
    estimated_arrival_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as rider_id,
        r.full_name,
        r.vehicle_type,
        r.rating,
        public.calculate_distance_km(
            pickup_lat,
            pickup_lng,
            (r.current_coordinates->>'lat')::DECIMAL,
            (r.current_coordinates->>'lng')::DECIMAL
        ) as distance_km,
        -- Estimate arrival time based on vehicle type and distance
        CASE
            WHEN r.vehicle_type IN ('bike', 'scooter', 'motorcycle') THEN
                (public.calculate_distance_km(
                    pickup_lat, pickup_lng,
                    (r.current_coordinates->>'lat')::DECIMAL,
                    (r.current_coordinates->>'lng')::DECIMAL
                ) * 3)::INTEGER -- ~20 km/h average
            WHEN r.vehicle_type = 'car' THEN
                (public.calculate_distance_km(
                    pickup_lat, pickup_lng,
                    (r.current_coordinates->>'lat')::DECIMAL,
                    (r.current_coordinates->>'lng')::DECIMAL
                ) * 2)::INTEGER -- ~30 km/h average in city
            ELSE
                (public.calculate_distance_km(
                    pickup_lat, pickup_lng,
                    (r.current_coordinates->>'lat')::DECIMAL,
                    (r.current_coordinates->>'lng')::DECIMAL
                ) * 6)::INTEGER -- ~10 km/h for bicycle/walking
        END as estimated_arrival_minutes
    FROM public.riders r
    WHERE
        r.is_online = TRUE
        AND r.status = 'active'
        AND r.current_coordinates IS NOT NULL
        AND public.calculate_distance_km(
            pickup_lat,
            pickup_lng,
            (r.current_coordinates->>'lat')::DECIMAL,
            (r.current_coordinates->>'lng')::DECIMAL
        ) <= LEAST(r.service_radius_km, max_distance_km)
    ORDER BY distance_km ASC, rating DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to generate tracking number
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    tracking_num VARCHAR(50);
    prefix VARCHAR(5) := 'TRK';
    timestamp_part VARCHAR(10);
    random_part VARCHAR(8);
BEGIN
    -- Get timestamp part (last 6 digits of unix timestamp)
    timestamp_part := RIGHT(EXTRACT(EPOCH FROM NOW())::TEXT, 6);

    -- Generate random alphanumeric string
    random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    tracking_num := prefix || timestamp_part || random_part;

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.delivery_requests WHERE tracking_number = tracking_num) LOOP
        random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
        tracking_num := prefix || timestamp_part || random_part;
    END LOOP;

    RETURN tracking_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger functions for automatic updates
CREATE OR REPLACE FUNCTION public.update_rider_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_coordinates IS DISTINCT FROM NEW.current_coordinates THEN
        NEW.last_location_update = NOW();
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_delivery_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Auto-complete when status changes to delivered
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        NEW.completed_at = NOW();
        NEW.actual_delivery_time = NOW();
    END IF;

    -- Generate tracking number for new requests
    IF TG_OP = 'INSERT' AND NEW.tracking_number IS NULL THEN
        NEW.tracking_number = public.generate_tracking_number();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_rider_location ON public.riders;
CREATE TRIGGER trigger_update_rider_location
    BEFORE UPDATE ON public.riders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rider_location_timestamp();

DROP TRIGGER IF EXISTS trigger_update_delivery_request ON public.delivery_requests;
CREATE TRIGGER trigger_update_delivery_request
    BEFORE INSERT OR UPDATE ON public.delivery_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_request_timestamp();

-- Create trigger to update rider earnings when delivery is completed
CREATE OR REPLACE FUNCTION public.update_rider_earnings_on_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- When delivery is completed, add earnings record
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.rider_id IS NOT NULL THEN
        INSERT INTO public.rider_earnings (
            rider_id,
            delivery_request_id,
            amount,
            earning_type,
            description,
            earned_date,
            month_year
        ) VALUES (
            NEW.rider_id,
            NEW.id,
            NEW.rider_earnings,
            'delivery_fee',
            'Delivery completed: ' || NEW.tracking_number,
            CURRENT_DATE,
            TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        );

        -- Update rider statistics
        UPDATE public.riders
        SET
            total_deliveries = total_deliveries + 1,
            completed_deliveries = completed_deliveries + 1,
            earnings_total = earnings_total + NEW.rider_earnings,
            earnings_this_month = earnings_this_month + NEW.rider_earnings,
            last_active_at = NOW()
        WHERE id = NEW.rider_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_rider_earnings ON public.delivery_requests;
CREATE TRIGGER trigger_update_rider_earnings
    AFTER UPDATE ON public.delivery_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_rider_earnings_on_completion();

-- Enable Row Level Security
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_earnings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for riders table
DROP POLICY IF EXISTS "Riders can view their own profile" ON public.riders;
CREATE POLICY "Riders can view their own profile" ON public.riders
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Riders can update their own profile" ON public.riders;
CREATE POLICY "Riders can update their own profile" ON public.riders
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow rider registration" ON public.riders;
CREATE POLICY "Allow rider registration" ON public.riders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for delivery_requests table
DROP POLICY IF EXISTS "Users can view their delivery requests" ON public.delivery_requests;
CREATE POLICY "Users can view their delivery requests" ON public.delivery_requests
    FOR SELECT USING (
        auth.uid() = customer_id OR
        auth.uid() = (SELECT user_id FROM public.riders WHERE id = rider_id)
    );

DROP POLICY IF EXISTS "Customers can create delivery requests" ON public.delivery_requests;
CREATE POLICY "Customers can create delivery requests" ON public.delivery_requests
    FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Riders can update assigned deliveries" ON public.delivery_requests;
CREATE POLICY "Riders can update assigned deliveries" ON public.delivery_requests
    FOR UPDATE USING (auth.uid() = (SELECT user_id FROM public.riders WHERE id = rider_id));

-- Create RLS policies for rider_earnings table
DROP POLICY IF EXISTS "Riders can view their own earnings" ON public.rider_earnings;
CREATE POLICY "Riders can view their own earnings" ON public.rider_earnings
    FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.riders WHERE id = rider_id));

-- Grant permissions
GRANT ALL ON public.riders TO authenticated;
GRANT ALL ON public.delivery_requests TO authenticated;
GRANT ALL ON public.rider_earnings TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_distance_km TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_riders TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_tracking_number TO authenticated;

-- Insert sample test rider
INSERT INTO public.riders (
    user_id, full_name, email, phone, vehicle_type, license_number,
    current_location, service_radius_km, status, base_location,
    current_coordinates, base_coordinates
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Test Rider Delhi',
    'test.rider.delhi@example.com',
    '+91-9876543210',
    'motorcycle',
    'DL1234567890',
    'Connaught Place, New Delhi',
    15.0,
    'active',
    'CP Metro Station, New Delhi',
    '{"lat": 28.6315, "lng": 77.2167}',
    '{"lat": 28.6315, "lng": 77.2167}'
) ON CONFLICT (email) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE public.riders IS 'Dedicated riders table for delivery and transport personnel';
COMMENT ON TABLE public.delivery_requests IS 'Table for managing delivery requests assigned to riders';
COMMENT ON TABLE public.rider_earnings IS 'Detailed earnings tracking for riders';
COMMENT ON FUNCTION public.find_available_riders IS 'Find available riders within specified distance for pickup';
COMMENT ON FUNCTION public.generate_tracking_number IS 'Generate unique tracking numbers for delivery requests';
        `;

    // Execute the complete SQL script
    await client.query(createRidersSQL);

    console.log("✅ Riders table created successfully!");

    // Verify the table was created
    const verifyQuery = `
            SELECT
                table_name,
                column_name,
                data_type
            FROM information_schema.columns
            WHERE table_name IN ('riders', 'delivery_requests', 'rider_earnings')
            AND table_schema = 'public'
            ORDER BY table_name, ordinal_position;
        `;

    const verifyResult = await client.query(verifyQuery);
    console.log(
      `\n📊 Created tables with ${verifyResult.rows.length} columns:`,
    );

    const tableGroups = verifyResult.rows.reduce((acc, row) => {
      if (!acc[row.table_name]) acc[row.table_name] = [];
      acc[row.table_name].push(`${row.column_name} (${row.data_type})`);
      return acc;
    }, {});

    Object.entries(tableGroups).forEach(([tableName, columns]) => {
      console.log(`\n📋 ${tableName}: ${columns.length} columns`);
      columns.slice(0, 5).forEach((col) => console.log(`   - ${col}`));
      if (columns.length > 5) {
        console.log(`   ... and ${columns.length - 5} more columns`);
      }
    });

    // Test rider count
    const countResult = await client.query(
      "SELECT COUNT(*) as count FROM public.riders",
    );
    console.log(`\n👥 Total riders in database: ${countResult.rows[0].count}`);

    // Test functions
    console.log("\n🧪 Testing database functions...");
    try {
      const funcTest = await client.query(`
                SELECT public.calculate_distance_km(28.6315, 77.2167, 28.6139, 77.2090) as distance;
            `);
      console.log(
        `✅ Distance calculation works: ${funcTest.rows[0].distance} km`,
      );
    } catch (err) {
      console.log("⚠️  Distance calculation test failed:", err.message);
    }

    console.log("\n🎉 Database setup completed successfully!");
    console.log("📋 Summary:");
    console.log("   ✅ riders table created");
    console.log("   ✅ delivery_requests table created");
    console.log("   ✅ rider_earnings table created");
    console.log("   ✅ Database functions created");
    console.log("   ✅ Indexes and triggers created");
    console.log("   ✅ Row Level Security enabled");
    console.log("   ✅ Sample data inserted");
  } catch (error) {
    console.error("❌ Error creating riders table:", error.message);
    console.error("Stack trace:", error.stack);
    throw error;
  } finally {
    await client.end();
    console.log("🔌 Database connection closed");
  }
}

// Run the setup
createRidersTable()
  .then(() => {
    console.log("\n🎯 Next steps:");
    console.log("   1. Update your app environment variables");
    console.log("   2. Test rider registration in your app");
    console.log("   3. Check the Supabase dashboard for the new tables");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Setup failed:", error.message);
    process.exit(1);
  });
