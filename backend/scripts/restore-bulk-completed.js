/**
 * Recovery script: restores orders bulk-completed on 2026-05-31 ~09:44–10:30 AM IST
 *
 * What happened: an admin session mass-updated all active orders to
 * pickup_completed → completed via PUT /api/admin/bookings/:id starting at
 * 2026-05-31T04:14 UTC (09:44 IST).
 *
 * The admin route uses findByIdAndUpdate so status_history was NOT updated.
 * We use the last status_history entry to recover the pre-bulk status.
 *
 * Run: node backend/scripts/restore-bulk-completed.js
 *      Add --dry-run to preview without writing changes
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Booking  = require("../models/Booking");

const DRY_RUN = process.argv.includes("--dry-run");

// Bulk update window: 04:10 UTC → 05:30 UTC on 2026-05-31
const BULK_START = new Date("2026-05-31T04:10:00.000Z");
const BULK_END   = new Date("2026-05-31T05:30:00.000Z");

// Statuses set by the bulk update
const BULK_STATUSES = ["pickup_completed", "completed"];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");
  console.log(DRY_RUN ? "🔍 DRY RUN — no changes will be written\n" : "⚠️  LIVE RUN — changes WILL be written\n");

  // Find all orders that were updated during the bulk window
  const affected = await Booking.find({
    updated_at: { $gte: BULK_START, $lte: BULK_END },
    status:     { $in: BULK_STATUSES },
  }).select("_id custom_order_id status updated_at status_history updated_by_admin").lean();

  console.log(`📋 Found ${affected.length} bookings updated during bulk window`);

  let restored = 0;
  let skipped  = 0;
  const errors  = [];

  for (const booking of affected) {
    try {
      // Find the most recent status_history entry (untouched by bulk update)
      const history = (booking.status_history || [])
        .map(h => ({ ...h, ts: new Date(h.changed_at || h.timestamp || 0).getTime() }))
        .sort((a, b) => b.ts - a.ts);

      const lastGoodEntry = history[0];

      if (!lastGoodEntry) {
        // No history → order was probably created just before bulk — default to "created"
        const prevStatus = "created";
        console.log(`  [NO HISTORY] ${booking.custom_order_id || booking._id} → restore to "created"`);
        if (!DRY_RUN) {
          await Booking.findByIdAndUpdate(booking._id, {
            status: prevStatus,
            updated_at: BULK_START, // roll back timestamp
            $unset: { updated_by_admin: "" },
          });
        }
        restored++;
        continue;
      }

      const prevStatus = lastGoodEntry.status;

      // If the last history entry is itself a bulk status, try the one before it
      const actualPrev = BULK_STATUSES.includes(prevStatus)
        ? (history[1]?.status || "vendor_assigned")
        : prevStatus;

      console.log(
        `  ${booking.custom_order_id || booking._id}: ${booking.status} → ${actualPrev}` +
        `  (history last: ${prevStatus} @ ${new Date(lastGoodEntry.ts).toISOString()})`
      );

      if (actualPrev === booking.status) {
        // Already correct (shouldn't happen but guard anyway)
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        await Booking.findByIdAndUpdate(booking._id, {
          status:     actualPrev,
          updated_at: new Date(lastGoodEntry.ts) || BULK_START,
          $unset: { updated_by_admin: "" },
        });
      }
      restored++;
    } catch (err) {
      errors.push({ id: booking._id, err: err.message });
      console.error(`  ❌ ${booking._id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done.`);
  console.log(`   Restored : ${restored}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Errors   : ${errors.length}`);
  if (DRY_RUN) console.log("\n  (DRY RUN — run without --dry-run to apply changes)");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
