const mongoose = require("mongoose");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cleancare_pro";

async function fixPGOrderIndex() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const pgOrdersCollection = db.collection("pgorders");

    console.log("\n📋 Current indexes on pgorders collection:");
    const indexes = await pgOrdersCollection.getIndexes();
    console.log(indexes);

    // Check if there's an order_id index that's causing the problem
    if (indexes.order_id_1) {
      console.log(
        "\n⚠️ Found problematic 'order_id_1' index. Dropping it..."
      );
      try {
        await pgOrdersCollection.dropIndex("order_id_1");
        console.log("✅ Successfully dropped 'order_id_1' index");
      } catch (dropError) {
        console.error("Error dropping order_id_1 index:", dropError.message);
      }
    }

    // Check if there's a custom_order_id index
    if (!indexes.custom_order_id_1) {
      console.log("\n📝 Creating custom_order_id unique index...");
      await pgOrdersCollection.createIndex(
        { custom_order_id: 1 },
        { unique: true, sparse: true }
      );
      console.log("✅ Created custom_order_id unique index");
    } else {
      console.log(
        "\n✅ custom_order_id index already exists:",
        indexes.custom_order_id_1
      );
    }

    console.log("\n📋 Updated indexes on pgorders collection:");
    const updatedIndexes = await pgOrdersCollection.getIndexes();
    console.log(updatedIndexes);

    // Also check for any documents with null order_id and fix them
    console.log(
      "\n🔍 Checking for documents with null order_id field..."
    );
    const nullOrderIdDocs = await pgOrdersCollection
      .find({ order_id: null })
      .countDocuments();

    if (nullOrderIdDocs > 0) {
      console.log(`⚠️ Found ${nullOrderIdDocs} documents with null order_id`);
      console.log("📝 Removing order_id field from all documents...");
      await pgOrdersCollection.updateMany(
        { order_id: null },
        { $unset: { order_id: 1 } }
      );
      console.log("✅ Removed null order_id fields");
    } else {
      console.log("✅ No documents with null order_id found");
    }

    console.log("\n✅ Index fix completed successfully!");
  } catch (error) {
    console.error("❌ Error fixing PGOrder index:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

fixPGOrderIndex();
