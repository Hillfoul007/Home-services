const express = require("express");
const router = express.Router();
const { getPackageBalance } = require("../utils/customerPackages");

// GET /api/customer-packages/balance/:phone — aggregated KG/PC package balance
// for a phone number. Used by the customer app checkout to offer applying a
// store-sold quantity package to the current cart.
router.get("/balance/:phone", async (req, res) => {
  try {
    const balance = await getPackageBalance(req.params.phone);
    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
