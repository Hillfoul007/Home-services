const mongoose = require("mongoose");

// MongoDB connection URI
const MONGODB_URI =
  "mongodb+srv://sunflower110001:fV4LhLpWlKj5Vx87@cluster0.ic8p792.mongodb.net/cleancare_pro?retryWrites=true&w=majority";

async function fixPGOrderIndex() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    console.log("📍 Database: cleancare_pro");

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const pgOrdersCollection = db.collection("pgorders");

    console.log("\n📋 Current indexes on pgorders collection:");
    try {
      const indexInfo = await pgOrdersCollection.indexInformation();
      console.log(JSON.stringify(indexInfo, null, 2));

      // Check if there's an order_id index that's causing the problem
      if (indexInfo["order_id_1"]) {
        console.log(
          "\n⚠️ Found problematic 'order_id_1' index. Dropping it..."
        );
        try {
          await pgOrdersCollection.dropIndex("order_id_1");
          console.log("✅ Successfully dropped 'order_id_1' index");
        } catch (dropError) {
          console.error("Error dropping order_id_1 index:", dropError.message);
        }
      } else {
        console.log(
          "\n✅ No problematic 'order_id_1' index found. Current indexes:"
        );
        console.log(Object.keys(indexInfo));
      }
    } catch (indexError) {
      console.error("Error reading indexes:", indexError.message);
    }

    // Check if there's a custom_order_id index
    console.log("\n📝 Ensuring custom_order_id unique index exists...");
    try {
      const indexInfo = await pgOrdersCollection.indexInformation();
      if (!indexInfo["custom_order_id_1"]) {
        await pgOrdersCollection.createIndex(
          { custom_order_id: 1 },
          { unique: true, sparse: true }
        );
        console.log("✅ Created custom_order_id unique index");
      } else {
        console.log(
          "✅ custom_order_id index already exists:",
          indexInfo["custom_order_id_1"]
        );
      }
    } catch (indexError) {
      console.error("Error managing custom_order_id index:", indexError.message);
    }

    console.log("\n📋 Updated indexes on pgorders collection:");
    try {
      const updatedIndexInfo = await pgOrdersCollection.indexInformation();
      console.log(JSON.stringify(updatedIndexInfo, null, 2));
    } catch (err) {
      console.error("Error reading updated indexes:", err.message);
    }

    // Also check for any documents with null order_id and fix them
    console.log(
      "\n🔍 Checking for documents with null order_id field..."
    );
    try {
      const nullOrderIdDocs = await pgOrdersCollection
        .find({ order_id: null })
        .countDocuments();

      if (nullOrderIdDocs > 0) {
        console.log(
          `⚠️ Found ${nullOrderIdDocs} documents with null order_id`
        );
        console.log(
          "📝 Removing order_id field from all documents with null order_id..."
        );
        const result = await pgOrdersCollection.updateMany(
          { order_id: null },
          { $unset: { order_id: 1 } }
        );
        console.log(
          `✅ Removed null order_id fields from ${result.modifiedCount} documents`
        );
      } else {
        console.log("✅ No documents with null order_id found");
      }
    } catch (docError) {
      console.error("Error handling null order_id documents:", docError.message);
    }

    console.log("\n✅ Index fix completed successfully!");
    console.log(
      "\n🎉 You can now create PG orders without encountering E11000 duplicate key errors."
    );
  } catch (error) {
    console.error("❌ Error fixing PGOrder index:", error.message);
    if (error.code === "ENOTFOUND") {
      console.error(
        "⚠️ Could not reach MongoDB cluster. Check your connection URI and internet connection."
      );
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

fixPGOrderIndex();
