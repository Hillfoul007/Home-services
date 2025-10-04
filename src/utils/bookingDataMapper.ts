import { laundryServices, getServiceById } from "@/data/laundryServices";

export interface MappedService {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  unit?: string;
}

export interface MappedBookingData {
  id: string;
  _id?: string;
  custom_order_id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  pickup_date: string;
  pickup_time: string;
  delivery_date: string;
  delivery_time: string;
  services: MappedService[];
  pricing: {
    base_amount: number;
    tax_amount: number;
    delivery_fee: number;
    handling_fee: number;
    discount_amount: number;
    final_amount: number;
  };
  payment_status: string;
  created_at: string;
  order_notes?: string;
  // Legacy properties for backward compatibility
  totalAmount?: number;
  total_price?: number;
  final_amount?: number;
}

/**
 * Service price mapping based on database schema and actual service catalog
 */
export const createServicePriceMap = (): Map<string, number> => {
  const priceMap = new Map<string, number>();

  // Create mapping from service names to prices
  laundryServices.forEach((service) => {
    // Primary mapping with exact service name
    priceMap.set(service.name.toLowerCase(), service.price);

    // Secondary mapping with simplified names for matching
    const simplifiedName = service.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
    priceMap.set(simplifiedName, service.price);

    // Additional mappings for common variations
    if (service.name.includes("Laundry")) {
      priceMap.set("laundry", service.price);
      if (service.name.includes("Iron")) {
        priceMap.set("laundry iron", service.price);
        priceMap.set("laundry and iron", service.price);
      } else if (service.name.includes("Fold")) {
        priceMap.set("laundry fold", service.price);
        priceMap.set("laundry and fold", service.price);
      }
    }

    if (service.name.includes("Coal Iron")) {
      priceMap.set("coal iron", service.price);
      priceMap.set("iron", service.price);
    }

    if (service.name.includes("Steam Iron")) {
      priceMap.set("steam iron", service.price);
      if (service.name.includes("Men's Suit")) {
        priceMap.set("mens suit steam", service.price);
        priceMap.set("suit steam", service.price);
      }
      if (service.name.includes("Ladies Suit")) {
        priceMap.set("ladies suit steam", service.price);
        priceMap.set("kurta steam", service.price);
      }
    }

    // Dry clean mappings
    if (
      service.category === "mens-dry-clean" ||
      service.category === "womens-dry-clean"
    ) {
      const baseName = service.name
        .toLowerCase()
        .replace("dry clean", "")
        .trim();
      priceMap.set(`${baseName} dry clean`, service.price);
      priceMap.set(`dry clean ${baseName}`, service.price);
    }
  });

  return priceMap;
};

/**
 * Calculate delivery date based on pickup date and service type
 */
export const calculateDeliveryDate = (
  pickupDate: string,
  serviceType?: string,
  deliveryDate?: string,
  deliveryTime?: string,
): { date: string; time: string } => {
  // If delivery date is explicitly provided and different from pickup, use it
  if (deliveryDate && deliveryDate !== pickupDate) {
    console.log(`📅 Using provided delivery date: ${deliveryDate}`);
    return {
      date: deliveryDate,
      time: deliveryTime || "18:00",
    };
  }

  let deliveryDays = 1; // Default delivery in 1 day

  // Adjust delivery time based on service type
  if (serviceType) {
    const lowerServiceType = serviceType.toLowerCase();

    if (lowerServiceType.includes("dry clean")) {
      if (
        lowerServiceType.includes("heavy") ||
        lowerServiceType.includes("luxury")
      ) {
        deliveryDays = 3; // 72 hours for heavy/luxury items
      } else if (
        lowerServiceType.includes("leather") ||
        lowerServiceType.includes("lehenga")
      ) {
        deliveryDays = 3; // 72 hours for special items
      } else {
        deliveryDays = 2; // 48 hours for regular dry clean
      }
    } else if (lowerServiceType.includes("laundry")) {
      if (lowerServiceType.includes("iron")) {
        deliveryDays = 2; // 48 hours for laundry + iron
      } else {
        deliveryDays = 1; // 24 hours for basic laundry
      }
    } else if (lowerServiceType.includes("iron")) {
      deliveryDays = 1; // 24 hours for iron services
    }
  }

  console.log(`📅 Calculating delivery date: pickup=${pickupDate}, serviceType=${serviceType}, deliveryDays=${deliveryDays}`);

  try {
    let pickupDateObj: Date;

    // Handle different date formats
    if (pickupDate.includes("-") && pickupDate.split("-").length === 3) {
      // YYYY-MM-DD format
      const [year, month, day] = pickupDate.split("-").map(Number);
      pickupDateObj = new Date(year, month - 1, day);
    } else {
      pickupDateObj = new Date(pickupDate);
    }

    if (isNaN(pickupDateObj.getTime())) {
      throw new Error("Invalid pickup date");
    }

    // Calculate delivery date
    const deliveryDateObj = new Date(pickupDateObj);
    deliveryDateObj.setDate(deliveryDateObj.getDate() + deliveryDays);

    // Format as YYYY-MM-DD
    const formattedDate = deliveryDateObj.toISOString().split("T")[0];

    console.log(`📅 Calculated delivery date: ${formattedDate} (${deliveryDays} days after ${pickupDate})`);

    return {
      date: formattedDate,
      time: deliveryTime || "18:00",
    };
  } catch (error) {
    console.error("Error calculating delivery date:", error);
    // Return a default delivery date (pickup + 1 day) instead of same date
    try {
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 1);
      const fallbackFormatted = fallbackDate.toISOString().split("T")[0];
      console.log(`📅 Using fallback delivery date: ${fallbackFormatted}`);
      return {
        date: fallbackFormatted,
        time: deliveryTime || "18:00",
      };
    } catch (fallbackError) {
      console.error("Fallback delivery date calculation failed:", fallbackError);
      return {
        date: pickupDate,
        time: deliveryTime || "18:00",
      };
    }
  }
};

/**
 * Map raw booking data from database to structured format
 */
export const mapBookingData = (rawBooking: any): MappedBookingData => {
  const priceMap = createServicePriceMap();

  // Map services with correct prices
  const mappedServices: MappedService[] = [];

  if (rawBooking.item_prices && Array.isArray(rawBooking.item_prices)) {
    // Use item_prices if available (most accurate)
    rawBooking.item_prices.forEach((item: any, index: number) => {
      mappedServices.push({
        id: `service_${index}`,
        name: item.service_name || `Service ${index + 1}`,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
        category: getServiceById(`service_${index}`)?.category,
        unit: getServiceById(`service_${index}`)?.unit,
      });
    });
  } else if (rawBooking.services && Array.isArray(rawBooking.services)) {
    // Fallback to services array and map prices
    rawBooking.services.forEach((service: any, index: number) => {
      let serviceName: string;
      let quantity = 1;
      let unitPrice = 0;

      if (typeof service === "string") {
        serviceName = service;
      } else if (typeof service === "object" && service) {
        serviceName = service.name || service.service || `Service ${index + 1}`;
        quantity = service.quantity || 1;
        unitPrice = service.price || service.unit_price || 0;
      } else {
        serviceName = `Service ${index + 1}`;
      }

      // Try to get price from mapping if not provided
      if (unitPrice === 0) {
        const lowerServiceName = serviceName.toLowerCase();
        unitPrice =
          priceMap.get(lowerServiceName) ||
          priceMap.get(lowerServiceName.replace(/[^a-z0-9\s]/g, "").trim()) ||
          100;
      }

      mappedServices.push({
        id: `service_${index}`,
        name: serviceName,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        category: getServiceById(`service_${index}`)?.category,
        unit: getServiceById(`service_${index}`)?.unit,
      });
    });
  }

  // Use delivery date from database if available, only calculate if missing
  const deliveryInfo = rawBooking.delivery_date ? {
    date: rawBooking.delivery_date,
    time: rawBooking.delivery_time || "18:00"
  } : calculateDeliveryDate(
    rawBooking.scheduled_date || rawBooking.pickup_date,
    rawBooking.service_type || rawBooking.service,
    undefined,
    rawBooking.delivery_time,
  );

  // Map pricing information
  const pricing = {
    base_amount:
      rawBooking.charges_breakdown?.base_price ||
      mappedServices.reduce((sum, service) => sum + service.total_price, 0),
    tax_amount: rawBooking.charges_breakdown?.tax_amount || 0,
    delivery_fee: rawBooking.charges_breakdown?.delivery_fee || 0,
    handling_fee: rawBooking.charges_breakdown?.handling_fee || 0,
    discount_amount:
      rawBooking.discount_amount || rawBooking.charges_breakdown?.discount || 0,
    final_amount:
      rawBooking.final_amount ||
      rawBooking.total_price ||
      mappedServices.reduce((sum, service) => sum + service.total_price, 0),
  };

  return {
    id: rawBooking._id || rawBooking.id,
    _id: rawBooking._id,
    custom_order_id: rawBooking.custom_order_id || rawBooking.order_id || "",
    status: rawBooking.status || "pending",
    customer_name: rawBooking.name || "N/A",
    customer_phone: rawBooking.phone || "N/A",
    address: rawBooking.address || "Address not provided",
    pickup_date: rawBooking.scheduled_date || "",
    pickup_time: rawBooking.scheduled_time || "10:00",
    delivery_date: deliveryInfo.date,
    delivery_time: rawBooking.delivery_time || deliveryInfo.time,
    services: mappedServices,
    pricing,
    payment_status: rawBooking.payment_status || "pending",
    created_at: rawBooking.created_at || rawBooking.createdAt || "",
    order_notes:
      rawBooking.additional_details || rawBooking.special_instructions,
    // Legacy properties for backward compatibility
    totalAmount: pricing.final_amount,
    total_price: pricing.final_amount,
    final_amount: pricing.final_amount,
  };
};

/**
 * Map multiple booking records
 */
export const mapBookingsData = (rawBookings: any[]): MappedBookingData[] => {
  return rawBookings.map(mapBookingData);
};

/**
 * Get service price by name using intelligent matching
 */
export const getServicePrice = (serviceName: string): number => {
  const priceMap = createServicePriceMap();
  const lowerServiceName = serviceName.toLowerCase();

  // Try exact match first
  let price = priceMap.get(lowerServiceName);
  if (price) return price;

  // Try simplified match
  const simplifiedName = lowerServiceName.replace(/[^a-z0-9\s]/g, "").trim();
  price = priceMap.get(simplifiedName);
  if (price) return price;

  // Try partial matches
  for (const [key, value] of priceMap) {
    if (key.includes(lowerServiceName) || lowerServiceName.includes(key)) {
      return value;
    }
  }

  // Default fallback
  return 100;
};
