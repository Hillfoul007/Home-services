const CustomerPackage = require("../models/CustomerPackage");

function usableQuery(phone, unit_type) {
  const now = new Date();
  return {
    customer_phone: phone,
    unit_type,
    is_active: true,
    remaining_quantity: { $gt: 0 },
    end_date: { $gte: now },
  };
}

/**
 * Returns remaining KG/PC balance for a phone number, summed across all
 * usable (active, non-expired, non-zero) packages regardless of which
 * store created them.
 */
async function getPackageBalance(phone) {
  const [kgDocs, pcDocs] = await Promise.all([
    CustomerPackage.find(usableQuery(phone, "KG")).select("remaining_quantity"),
    CustomerPackage.find(usableQuery(phone, "PC")).select("remaining_quantity"),
  ]);
  return {
    KG: kgDocs.reduce((sum, d) => sum + d.remaining_quantity, 0),
    PC: pcDocs.reduce((sum, d) => sum + d.remaining_quantity, 0),
  };
}

/**
 * Deducts `quantity` of `unit_type` from a phone's usable packages, FIFO by
 * soonest end_date. Throws an Error with a user-facing message if the
 * combined balance is insufficient — callers should respond 400.
 * Returns { amount_covered } where amount_covered is the price-weighted
 * value of the deducted quantity (proportional to each package's price/total_quantity).
 */
async function deductPackageBalance(phone, unit_type, quantity) {
  if (!quantity || quantity <= 0) return { amount_covered: 0 };

  const docs = await CustomerPackage.find(usableQuery(phone, unit_type)).sort({ end_date: 1 });
  const available = docs.reduce((sum, d) => sum + d.remaining_quantity, 0);

  if (available < quantity) {
    throw new Error("Insufficient package balance");
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
