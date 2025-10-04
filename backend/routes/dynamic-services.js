const express = require("express");
const { google } = require("googleapis");
const router = express.Router();

// Service cache
let servicesCache = [];
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Default services structure for Google Sheets
const DEFAULT_SERVICES = [
  {
    id: "wash-fold",
    name: "Wash & Fold",
    icon: "👕",
    color: "from-blue-500 to-blue-600",
    description: "Professional washing and folding service",
    enabled: true,
    services: [
      {
        id: "wf-regular",
        name: "Laundry and Fold",
        category: "Wash & Fold",
        price: 70,
        unit: "per kg",
        description: "Regular wash and fold service",
        minQuantity: 1,
        popular: true,
        enabled: true,
        image: "",
      },
      {
        id: "wf-bulk",
        name: "Laundry and Fold (Bulk)",
        category: "Wash & Fold",
        price: 60,
        unit: "per kg",
        description: "Bulk pricing for 3kg and above",
        minQuantity: 3,
        enabled: true,
        image: "",
      },
    ],
  },
  {
    id: "wash-iron",
    name: "Wash & Iron",
    icon: "🏷️",
    color: "from-green-500 to-green-600",
    description: "Washing with professional ironing",
    enabled: true,
    services: [
      {
        id: "wi-regular",
        name: "Laundry and Iron",
        category: "Wash & Iron",
        price: 120,
        unit: "per kg",
        description: "Professional wash and iron service",
        minQuantity: 1,
        popular: true,
        enabled: true,
        image: "",
      },
      {
        id: "wi-bulk",
        name: "Laundry and Iron (Bulk)",
        category: "Wash & Iron",
        price: 110,
        unit: "per kg",
        description: "Bulk pricing for 3kg and above",
        minQuantity: 3,
        enabled: true,
        image: "",
      },
    ],
  },
  {
    id: "steam-iron",
    name: "Steam Iron Only",
    icon: "🔥",
    color: "from-orange-500 to-orange-600",
    description: "Professional steam ironing service",
    enabled: true,
    services: [
      {
        id: "si-premium",
        name: "Premium Items (Steam Iron)",
        category: "Steam Iron",
        subcategory: "Premium",
        price: 50,
        unit: "per piece",
        description: "Coat, Lehenga, Sweatshirt, Sweater, Achkan",
        popular: true,
        enabled: true,
        image: "",
      },
      {
        id: "si-regular",
        name: "Regular Items (Steam Iron)",
        category: "Steam Iron",
        subcategory: "Regular",
        price: 30,
        unit: "per piece",
        description: "All other garments",
        enabled: true,
        image: "",
      },
    ],
  },
  {
    id: "mens-dry-clean",
    name: "Men's Dry Clean",
    icon: "👔",
    color: "from-purple-500 to-purple-600",
    description: "Professional dry cleaning for men's wear",
    enabled: true,
    services: [
      {
        id: "mdc-shirt",
        name: "Shirt/T-Shirt",
        category: "Men's Dry Clean",
        price: 90,
        unit: "per piece",
        description: "Professional dry cleaning for shirts",
        popular: true,
        enabled: true,
        image: "",
      },
      {
        id: "mdc-trouser",
        name: "Trouser/Jeans",
        category: "Men's Dry Clean",
        price: 120,
        unit: "per piece",
        description: "Dry cleaning for trousers and jeans",
        enabled: true,
        image: "",
      },
      {
        id: "mdc-coat",
        name: "Coat",
        category: "Men's Dry Clean",
        price: 220,
        unit: "per piece",
        description: "Professional coat dry cleaning",
        enabled: true,
        image: "",
      },
    ],
  },
  {
    id: "womens-dry-clean",
    name: "Women's Dry Clean",
    icon: "👗",
    color: "from-pink-500 to-pink-600",
    description: "Specialized dry cleaning for women's wear",
    enabled: true,
    services: [
      {
        id: "wdc-kurta",
        name: "Kurta",
        category: "Women's Dry Clean",
        price: 140,
        unit: "per piece",
        description: "Professional kurta dry cleaning",
        popular: true,
        enabled: true,
        image: "",
      },
      {
        id: "wdc-salwar",
        name: "Salwar/Plazo/Dupatta",
        category: "Women's Dry Clean",
        price: 120,
        unit: "per piece",
        description: "Bottom wear and dupatta cleaning",
        enabled: true,
        image: "",
      },
      {
        id: "wdc-saree-simple",
        name: "Saree (Simple/Silk)",
        category: "Women's Dry Clean",
        price: 210,
        unit: "per piece",
        description: "Regular and silk saree cleaning",
        enabled: true,
        image: "",
      },
      {
        id: "wdc-lehenga-2pc",
        name: "Lehenga (2+ Pieces)",
        category: "Women's Dry Clean",
        price: 450,
        unit: "per set",
        description: "Multi-piece lehenga set",
        popular: true,
        enabled: true,
        image: "",
      },
    ],
  },
  {
    id: "woolen-dry-clean",
    name: "Woolen Dry Clean",
    icon: "🧥",
    color: "from-indigo-500 to-indigo-600",
    description: "Specialized care for woolen and winter wear",
    enabled: true,
    services: [
      {
        id: "wol-jacket",
        name: "Jacket (Full/Half Sleeves)",
        category: "Woolen Dry Clean",
        price: 300,
        unit: "per piece",
        description: "Professional jacket cleaning",
        popular: true,
        enabled: true,
        image:
          "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fb935c8c1aa864281bd31c892116f9719?format=webp&width=800",
      },
      {
        id: "wol-sweater",
        name: "Sweater/Sweatshirt",
        category: "Woolen Dry Clean",
        price: 200,
        unit: "per piece",
        description: "Sweater and sweatshirt care",
        enabled: true,
        image: "",
      },
      {
        id: "wol-long-coat",
        name: "Long Coat",
        category: "Woolen Dry Clean",
        price: 400,
        unit: "per piece",
        description: "Long winter coat cleaning",
        enabled: true,
        image: "",
      },
      {
        id: "wol-shawl",
        name: "Shawl",
        category: "Woolen Dry Clean",
        price: 250,
        unit: "per piece",
        description: "Delicate shawl cleaning",
        enabled: true,
        image: "",
      },
      {
        id: "wol-pashmina",
        name: "Pashmina",
        category: "Woolen Dry Clean",
        price: 550,
        unit: "per piece",
        description: "Premium pashmina care",
        enabled: true,
        image: "",
      },
      {
        id: "wol-leather",
        name: "Leather Jacket",
        category: "Woolen Dry Clean",
        price: 600,
        unit: "per piece",
        description: "Specialized leather jacket cleaning",
        enabled: true,
        image: "",
      },
    ],
  },
];

// Initialize Google Sheets API
let sheets = null;
let auth = null;

async function initializeGoogleSheets() {
  if (
    !process.env.GOOGLE_SHEETS_ENABLED ||
    process.env.GOOGLE_SHEETS_ENABLED !== "true"
  ) {
    console.log("📊 Google Sheets integration disabled for services");
    return false;
  }

  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH) {
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    } else {
      console.log(
        "⚠️ No Google Service Account credentials found for services",
      );
      return false;
    }

    sheets = google.sheets({ version: "v4", auth });
    console.log("✅ Google Sheets API initialized for services");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to initialize Google Sheets for services:",
      error.message,
    );
    return false;
  }
}

// Fetch services from Google Sheets
async function fetchServicesFromSheets() {
  if (!sheets || !process.env.SERVICES_SHEET_ID) {
    console.log("📊 Google Sheets not available, using default services");
    return DEFAULT_SERVICES;
  }

  try {
    console.log("📊 Fetching services from Google Sheets...");

    // Fetch services data from the Services sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SERVICES_SHEET_ID,
      range: "Services!A:L", // Adjust range as needed
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      console.log("📊 No data found in Services sheet, using defaults");
      return DEFAULT_SERVICES;
    }

    // Parse the sheet data
    const services = parseServicesFromSheet(rows);

    console.log(
      `✅ Loaded ${services.length} service categories from Google Sheets`,
    );
    return services;
  } catch (error) {
    console.error(
      "❌ Error fetching services from Google Sheets:",
      error.message,
    );
    return DEFAULT_SERVICES;
  }
}

// Parse services data from Google Sheets format
function parseServicesFromSheet(rows) {
  // Skip header row
  const dataRows = rows.slice(1);

  const categoriesMap = new Map();

  dataRows.forEach((row) => {
    // Expected columns: Category ID, Category Name, Category Icon, Category Color,
    // Category Description, Service ID, Service Name, Price, Unit, Description,
    // Popular, Enabled, Image URL
    const [
      categoryId,
      categoryName,
      categoryIcon,
      categoryColor,
      categoryDescription,
      serviceId,
      serviceName,
      price,
      unit,
      serviceDescription,
      popular,
      enabled,
      imageUrl,
    ] = row;

    if (!categoryId || !serviceId) return; // Skip invalid rows

    // Initialize category if not exists
    if (!categoriesMap.has(categoryId)) {
      categoriesMap.set(categoryId, {
        id: categoryId,
        name: categoryName || categoryId,
        icon: categoryIcon || "🧺",
        color: categoryColor || "from-blue-500 to-blue-600",
        description: categoryDescription || "",
        enabled: enabled !== "false" && enabled !== "0",
        services: [],
      });
    }

    // Add service to category
    const category = categoriesMap.get(categoryId);
    category.services.push({
      id: serviceId,
      name: serviceName || serviceId,
      category: categoryName || categoryId,
      price: parseFloat(price) || 0,
      unit: unit || "per piece",
      description: serviceDescription || "",
      popular: popular === "true" || popular === "1",
      enabled: enabled !== "false" && enabled !== "0",
      image: imageUrl || "",
      minQuantity: 1,
    });
  });

  return Array.from(categoriesMap.values()).filter((cat) => cat.enabled);
}

// Setup Google Sheets on module load
initializeGoogleSheets();

// GET /api/services/dynamic - Get all dynamic services
router.get("/dynamic", async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (servicesCache.length > 0 && now - lastFetch < CACHE_DURATION) {
      return res.json({
        success: true,
        data: servicesCache,
        cached: true,
        lastFetch: new Date(lastFetch).toISOString(),
      });
    }

    // Fetch fresh data from Google Sheets
    const services = await fetchServicesFromSheets();

    // Update cache
    servicesCache = services;
    lastFetch = now;

    res.json({
      success: true,
      data: services,
      cached: false,
      lastFetch: new Date(lastFetch).toISOString(),
    });
  } catch (error) {
    console.error("❌ Error in /api/services/dynamic:", error);

    // Return cached data if available, otherwise defaults
    const fallbackData =
      servicesCache.length > 0 ? servicesCache : DEFAULT_SERVICES;

    res.json({
      success: true,
      data: fallbackData,
      error: error.message,
      fallback: true,
    });
  }
});

// GET /api/services/refresh - Force refresh services from Google Sheets
router.get("/refresh", async (req, res) => {
  try {
    console.log("🔄 Force refreshing services from Google Sheets...");

    const services = await fetchServicesFromSheets();

    // Update cache
    servicesCache = services;
    lastFetch = Date.now();

    res.json({
      success: true,
      message: "Services refreshed successfully",
      data: services,
      lastFetch: new Date(lastFetch).toISOString(),
    });
  } catch (error) {
    console.error("❌ Error refreshing services:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /api/services/:serviceId - Update a service (for admin use)
router.put("/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const updates = req.body;

    // For now, just return success as Google Sheets updates would need write permissions
    // In a full implementation, you'd update the Google Sheet here

    console.log(`📝 Service update request for ${serviceId}:`, updates);

    res.json({
      success: true,
      message: "Service update received (manual sheet update required)",
      serviceId,
      updates,
    });
  } catch (error) {
    console.error("❌ Error updating service:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/services/setup-sheet - Create default services in Google Sheets
router.get("/setup-sheet", async (req, res) => {
  try {
    if (!sheets || !process.env.SERVICES_SHEET_ID) {
      return res.status(400).json({
        success: false,
        error: "Google Sheets not configured",
      });
    }

    // Create headers
    const headers = [
      "Category ID",
      "Category Name",
      "Category Icon",
      "Category Color",
      "Category Description",
      "Service ID",
      "Service Name",
      "Price",
      "Unit",
      "Description",
      "Popular",
      "Enabled",
      "Image URL",
    ];

    // Create data rows from default services
    const rows = [headers];

    DEFAULT_SERVICES.forEach((category) => {
      category.services.forEach((service) => {
        rows.push([
          category.id,
          category.name,
          category.icon,
          category.color,
          category.description,
          service.id,
          service.name,
          service.price,
          service.unit,
          service.description,
          service.popular ? "true" : "false",
          service.enabled !== false ? "true" : "false",
          service.image || "",
        ]);
      });
    });

    // Write to Google Sheets
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SERVICES_SHEET_ID,
      range: "Services!A:M",
      valueInputOption: "RAW",
      resource: {
        values: rows,
      },
    });

    res.json({
      success: true,
      message: "Default services written to Google Sheets",
      rowsWritten: rows.length,
    });
  } catch (error) {
    console.error("❌ Error setting up services sheet:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
