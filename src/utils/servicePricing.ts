import { laundryServices } from "@/data/laundryServices";

export interface ServicePriceInfo {
  unitPrice: number;
  name: string;
  category: string;
  unit: string;
}

// Create a map for quick service lookup by name
const serviceNameMap = new Map<string, ServicePriceInfo>();

// Initialize the maps
laundryServices.forEach((service) => {
  const priceInfo: ServicePriceInfo = {
    unitPrice: service.price,
    name: service.name,
    category: service.category,
    unit: service.unit,
  };

  // Add to name map (convert to lowercase for easier matching)
  serviceNameMap.set(service.name.toLowerCase(), priceInfo);

  // Add variations of the name for better matching
  const variations = [
    service.name.toLowerCase().replace(/\s+/g, ""),
    service.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
  ];

  variations.forEach((variation) => {
    if (variation && !serviceNameMap.has(variation)) {
      serviceNameMap.set(variation, priceInfo);
    }
  });
});

/**
 * Get service price by exact or fuzzy name matching
 */
export const getServicePrice = (
  serviceName: string,
): ServicePriceInfo | null => {
  if (!serviceName) return null;

  const lowerServiceName = serviceName.toLowerCase();

  // Try exact match first
  if (serviceNameMap.has(lowerServiceName)) {
    return serviceNameMap.get(lowerServiceName)!;
  }

  // Try fuzzy matching - find services that contain the search term
  for (const [key, value] of serviceNameMap.entries()) {
    if (key.includes(lowerServiceName) || lowerServiceName.includes(key)) {
      return value;
    }
  }

  // Try partial word matching
  const searchWords = lowerServiceName.split(/\s+/);
  for (const [key, value] of serviceNameMap.entries()) {
    if (searchWords.some((word) => key.includes(word) && word.length > 2)) {
      return value;
    }
  }

  return null;
};

/**
 * Get service price with fallback logic for common service types
 */
export const getServicePriceWithFallback = (
  serviceName: string,
): ServicePriceInfo => {
  const foundService = getServicePrice(serviceName);
  if (foundService) {
    return foundService;
  }

  // Fallback based on common patterns
  const lowerServiceName = serviceName.toLowerCase();

  if (
    lowerServiceName.includes("coal iron") ||
    lowerServiceName.includes("coal")
  ) {
    return { unitPrice: 20, name: "Coal Iron", category: "iron", unit: "PC" };
  }

  if (lowerServiceName.includes("steam iron")) {
    if (
      lowerServiceName.includes("suit") ||
      lowerServiceName.includes("heavy")
    ) {
      return {
        unitPrice: 150,
        name: "Steam Iron - Heavy Items",
        category: "iron",
        unit: "SET",
      };
    }
    return {
      unitPrice: 40,
      name: "Steam Iron - General",
      category: "iron",
      unit: "PC",
    };
  }

  if (lowerServiceName.includes("laundry")) {
    if (lowerServiceName.includes("iron")) {
      return {
        unitPrice: 120,
        name: "Laundry and Iron",
        category: "laundry",
        unit: "KG",
      };
    }
    return {
      unitPrice: 70,
      name: "Laundry and Fold",
      category: "laundry",
      unit: "KG",
    };
  }

  if (
    lowerServiceName.includes("dry clean") ||
    lowerServiceName.includes("dry-clean")
  ) {
    if (lowerServiceName.includes("suit")) {
      return {
        unitPrice: 360,
        name: "Men's Suit",
        category: "mens-dry-clean",
        unit: "SET",
      };
    }
    if (lowerServiceName.includes("saree")) {
      return {
        unitPrice: 240,
        name: "Saree",
        category: "womens-dry-clean",
        unit: "PC",
      };
    }
    if (lowerServiceName.includes("kurta")) {
      return {
        unitPrice: 120,
        name: "Kurta",
        category: "mens-dry-clean",
        unit: "PC",
      };
    }
    if (lowerServiceName.includes("shirt")) {
      return {
        unitPrice: 100,
        name: "Men's Shirt",
        category: "mens-dry-clean",
        unit: "PC",
      };
    }
    return {
      unitPrice: 120,
      name: "Dry Clean General",
      category: "dry-clean",
      unit: "PC",
    };
  }

  // Last resort fallback
  return { unitPrice: 50, name: serviceName, category: "general", unit: "PC" };
};

/**
 * Calculate total price for a service with quantity
 */
export const calculateServiceTotal = (
  serviceName: string,
  quantity: number = 1,
): number => {
  const serviceInfo = getServicePriceWithFallback(serviceName);
  return serviceInfo.unitPrice * quantity;
};
