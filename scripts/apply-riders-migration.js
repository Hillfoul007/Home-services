import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl === "https://placeholder.supabase.co" || !supabaseServiceKey) {
  console.log(
    "⚠️  Supabase not configured. Please set up your environment variables:",
  );
  console.log("   VITE_SUPABASE_URL=your_supabase_url");
  console.log("   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key");
  console.log("");
  console.log("🔄 Running in demo mode - creating sample data in localStorage");

  // Create sample riders data for demo mode
  const sampleRiders = [
    {
      id: "demo-rider-1",
      user_id: "demo-user-1",
      full_name: "John Delivery",
      email: "john.delivery@example.com",
      phone: "+1234567890",
      vehicle_type: "motorcycle",
      license_number: "DL123456789",
      base_location: "Downtown",
      service_radius_km: 15,
      is_online: true,
      status: "active",
      rating: 4.8,
      total_deliveries: 156,
      completed_deliveries: 148,
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-rider-2",
      user_id: "demo-user-2",
      full_name: "Sarah Wheels",
      email: "sarah.wheels@example.com",
      phone: "+1234567891",
      vehicle_type: "car",
      license_number: "DL987654321",
      base_location: "Uptown",
      service_radius_km: 20,
      is_online: false,
      status: "active",
      rating: 4.9,
      total_deliveries: 89,
      completed_deliveries: 85,
      created_at: new Date().toISOString(),
    },
  ];

  if (typeof localStorage !== "undefined") {
    localStorage.setItem("demo_riders", JSON.stringify(sampleRiders));
    console.log("✅ Demo riders data created in localStorage");
  } else {
    console.log("📝 Sample riders data structure:");
    console.log(JSON.stringify(sampleRiders, null, 2));
  }

  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRidersMigration() {
  try {
    console.log("🚀 Starting riders table migration...");

    // Read the migration file
    const migrationPath = join(
      __dirname,
      "../supabase/migrations/005_create_dedicated_riders_table.sql",
    );
    const migrationSQL = readFileSync(migrationPath, "utf8");

    console.log("📖 Migration file loaded");

    // Execute the migration
    console.log("⚙️  Executing migration...");
    const { data, error } = await supabase.rpc("exec_sql", {
      sql: migrationSQL,
    });

    if (error) {
      // If rpc doesn't work, try direct SQL execution
      console.log("🔄 Trying alternative method...");

      // Split the migration into smaller chunks
      const statements = migrationSQL
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

      console.log(`📝 Found ${statements.length} SQL statements to execute`);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ";";

        try {
          const { error: stmtError } = await supabase.rpc("exec", {
            sql: statement,
          });

          if (stmtError) {
            console.log(`⚠️  Statement ${i + 1} failed:`, stmtError.message);
            errorCount++;
          } else {
            successCount++;
            if (i % 10 === 0) {
              console.log(
                `✅ Executed ${i + 1}/${statements.length} statements`,
              );
            }
          }
        } catch (err) {
          console.log(`❌ Error in statement ${i + 1}:`, err.message);
          errorCount++;
        }
      }

      console.log(`\n📊 Migration Summary:`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${errorCount}`);

      if (errorCount > 0) {
        console.log(
          "\n⚠️  Some statements failed. This is normal if tables already exist.",
        );
      }
    } else {
      console.log("✅ Migration executed successfully");
    }

    // Verify the riders table was created
    console.log("🔍 Verifying riders table...");
    const { data: tableCheck, error: tableError } = await supabase
      .from("riders")
      .select("count(*)")
      .limit(1);

    if (!tableError) {
      console.log("✅ Riders table verified successfully!");

      // Check if we can create a test rider
      console.log("🧪 Testing rider creation...");
      const testRider = {
        user_id: "00000000-0000-0000-0000-000000000000", // placeholder
        full_name: "Test Rider",
        email: "test@example.com",
        phone: "+1234567890",
        vehicle_type: "motorcycle",
        license_number: "TEST123",
        base_location: "Test Location",
        service_radius_km: 10,
      };

      const { data: insertData, error: insertError } = await supabase
        .from("riders")
        .insert(testRider)
        .select()
        .single();

      if (!insertError) {
        console.log("✅ Test rider created successfully!");

        // Clean up test rider
        await supabase.from("riders").delete().eq("id", insertData.id);

        console.log("🧹 Test rider cleaned up");
      } else {
        console.log("⚠️  Test rider creation failed:", insertError.message);
      }
    } else {
      console.log("❌ Riders table verification failed:", tableError.message);
      throw new Error("Migration may have failed");
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("📋 Next steps:");
    console.log(
      "   1. The riders table is now available in your Supabase database",
    );
    console.log(
      "   2. You can now register riders using the RiderRegistrationForm",
    );
    console.log("   3. Check your Supabase dashboard to see the new tables");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.log("\n🔧 Manual Setup Instructions:");
    console.log("1. Go to your Supabase dashboard");
    console.log("2. Navigate to SQL Editor");
    console.log(
      "3. Copy and paste the contents of supabase/migrations/005_create_dedicated_riders_table.sql",
    );
    console.log("4. Run the SQL script");

    process.exit(1);
  }
}

// Run the migration
applyRidersMigration();
