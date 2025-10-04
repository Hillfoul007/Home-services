const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

async function initializeDatabase() {
  console.log("🚀 Initializing database...");

  try {
    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "../supabase/migrations/002_create_backend_tables.sql",
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("📄 Running database migration...");

    // Execute the migration
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: migrationSQL,
    });

    if (error) {
      console.error("❌ Migration failed:", error);
      console.log("\n💡 Manual setup required. Please follow these steps:");
      console.log("1. Go to https://supabase.com/dashboard");
      console.log("2. Select your project");
      console.log("3. Go to SQL Editor");
      console.log(
        "4. Copy and paste the contents of supabase/migrations/002_create_backend_tables.sql",
      );
      console.log('5. Click "Run" to execute the migration');
      return;
    }

    console.log("✅ Database migration completed successfully!");

    // Verify tables exist
    console.log("🔍 Verifying tables...");
    const { data: tables, error: tablesError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_type", "BASE TABLE");

    if (tablesError) {
      console.log(
        "⚠️  Could not verify tables, but migration may have succeeded",
      );
    } else {
      const tableNames = tables
        .map((t) => t.table_name)
        .filter((name) =>
          ["users", "riders", "bookings", "providers"].includes(name),
        );
      console.log("📋 Created tables:", tableNames.join(", "));
    }

    console.log("\n🎉 Database initialization complete!");
    console.log(
      "🚀 You can now start the backend server with: npm run dev:backend",
    );
  } catch (error) {
    console.error("❌ Database initialization failed:", error.message);
    console.log(
      "\n💡 Please follow the manual setup instructions in setup-database.md",
    );
  }
}

// Check if we have the required environment variables
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error("❌ Missing required environment variables:");
  console.log("   VITE_SUPABASE_URL");
  console.log("   VITE_SUPABASE_ANON_KEY");
  console.log("\n💡 Please check your .env file");
  process.exit(1);
}

initializeDatabase();
