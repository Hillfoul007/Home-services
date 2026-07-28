const CustomerPackage = require("../models/CustomerPackage");

function usableQuery(phone, service_name) {
  const now = new Date();
  return {
    customer_phone: phone,
    service_name,
    is_active: true,
    remaining_quantity: { $gt: 0 },
    end_date: { $gte: now },
  };
}

/**
 * Returns remaining balance for a phone number, broken down per service
 * (e.g. "Laundry and Fold", "Laundry and Iron"), summed across all usable
 * (active, non-expired, non-zero) packages for that service — regardless of
 * which store created them.
 */
async function getPackageBalance(phone) {
  const docs = await CustomerPackage.find({
    customer_phone: phone,
    is_active: true,
    remaining_quantity: { $gt: 0 },
    end_date: { $gte: new Date() },
  }).select("service_name unit_type remaining_quantity");

  const byService = {};
  for (const doc of docs) {
    if (!byService[doc.service_name]) {
      byService[doc.service_name] = {
        service_name: doc.service_name,
        unit_type: doc.unit_type,
        remaining_quantity: 0,
      };
    }
    byService[doc.service_name].remaining_quantity += doc.remaining_quantity;
  }

  return Object.values(byService);
}

/**
 * Deducts `quantity` from a phone's usable packages for a specific service,
 * FIFO by soonest end_date. Throws an Error with a user-facing message if
 * the combined balance is insufficient — callers should respond 400.
 *
 * Records a consumption_history entry on each package document touched, so
 * usage can be audited later. The order isn't created yet at this point (we
 * deduct before creating the order so an insufficient balance can block
 * order creation), so each entry starts with a null order reference —
 * callers must call attachOrderToConsumption() once the order is saved.
 *
 * Returns { amount_covered, touched } where touched is
 * [{ package_id, history_id, quantity }] identifying the exact
 * consumption_history subdocuments to patch with the real order reference.
 */
async function deductPackageBalance(phone, service_name, quantity) {
  if (!quantity || quantity <= 0) return { amount_covered: 0, touched: [] };

  const docs = await CustomerPackage.find(usableQuery(phone, service_name)).sort({ end_date: 1 });
  const available = docs.reduce((sum, d) => sum + d.remaining_quantity, 0);

  if (available < quantity) {
    throw new Error(`Insufficient package balance for ${service_name}`);
  }

  let remainingToDeduct = quantity;
  let amountCovered = 0;
  const touched = [];

  for (const doc of docs) {
    if (remainingToDeduct <= 0) break;
    const take = Math.min(doc.remaining_quantity, remainingToDeduct);
    if (take <= 0) continue;

    const unitValue = doc.total_quantity > 0 ? doc.price / doc.total_quantity : 0;
    const takeAmount = take * unitValue;
    amountCovered += takeAmount;

    doc.remaining_quantity -= take;
    doc.consumption_history.push({ quantity: take, amount_covered: takeAmount });
    remainingToDeduct -= take;
    await doc.save();

    const pushedEntry = doc.consumption_history[doc.consumption_history.length - 1];
    touched.push({ package_id: doc._id, history_id: pushedEntry._id, quantity: take });
  }

  return { amount_covered: amountCovered, touched };
}

/**
 * Patches the consumption_history entries created by deductPackageBalance
 * with the real order reference, once the order has been successfully
 * created. Safe to call with an empty `touched` array (no-op).
 */
async function attachOrderToConsumption(touched, { order_id, order_custom_id, order_type }) {
  if (!touched || touched.length === 0) return;
  await Promise.all(
    touched.map(({ package_id, history_id }) =>
      CustomerPackage.updateOne(
        { _id: package_id, "consumption_history._id": history_id },
        {
          $set: {
            "consumption_history.$.order_id": order_id,
            "consumption_history.$.order_custom_id": order_custom_id,
            "consumption_history.$.order_type": order_type,
          },
        }
      )
    )
  );
}

module.exports = { getPackageBalance, deductPackageBalance, attachOrderToConsumption };
