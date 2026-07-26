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
 * Returns { amount_covered } where amount_covered is the price-weighted
 * value of the deducted quantity (proportional to each package's price/total_quantity).
 */
async function deductPackageBalance(phone, service_name, quantity) {
  if (!quantity || quantity <= 0) return { amount_covered: 0 };

  const docs = await CustomerPackage.find(usableQuery(phone, service_name)).sort({ end_date: 1 });
  const available = docs.reduce((sum, d) => sum + d.remaining_quantity, 0);

  if (available < quantity) {
    throw new Error(`Insufficient package balance for ${service_name}`);
  }

  let remainingToDeduct = quantity;
  let amountCovered = 0;

  for (const doc of docs) {
    if (remainingToDeduct <= 0) break;
    const take = Math.min(doc.remaining_quantity, remainingToDeduct);
    if (take <= 0) continue;

    const unitValue = doc.total_quantity > 0 ? doc.price / doc.total_quantity : 0;
    amountCovered += take * unitValue;

    doc.remaining_quantity -= take;
    remainingToDeduct -= take;
    await doc.save();
  }

  return { amount_covered: amountCovered };
}

module.exports = { getPackageBalance, deductPackageBalance };
