/**
 * Vendor Service
 * Handles vendor management and distance calculations
 */

export interface VendorDetails {
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  services: string[];
  contactPhone?: string;
  rating?: number;
  isActive: boolean;
}

export interface VendorWithDistance extends VendorDetails {
  distance: number; // Distance in kilometers
  estimatedTime: number; // Estimated delivery time in minutes
}

export class VendorService {
  private static instance: VendorService;
  
  // Static vendor data - in production this would come from a database
  private vendors: VendorDetails[] = [
    {
      id: "vendor1",
      name: "Priya Dry Cleaners",
      address: "Shop n.155, Spaze corporate park, 1sf, Sector 69, Gurugram, Haryana 122101",
      coordinates: {
        lat: 28.3984,
        lng: 77.0648
      },
      services: ["Dry Cleaning", "Laundry", "Ironing", "Stain Removal"],
      contactPhone: "+91 9876543210",
      rating: 4.5,
      isActive: true
    },
    {
      id: "vendor2", 
      name: "White Tiger Dry Cleaning",
      address: "Shop No. 153, First Floor, Spaze Corporate Park, Sector 69, Gurugram, Haryana 122101",
      coordinates: {
        lat: 28.3982,
        lng: 77.0650
      },
      services: ["Dry Cleaning", "Premium Care", "Express Service", "Alterations"],
      contactPhone: "+91 9876543211",
      rating: 4.3,
      isActive: true
    }
  ];

  public static getInstance(): VendorService {
    if (!VendorService.instance) {
      VendorService.instance = new VendorService();
    }
    return VendorService.instance;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Estimate delivery time based on distance
   */
  private estimateDeliveryTime(distance: number): number {
    // Base time for processing (30 minutes) + travel time
    // Assuming average speed of 20 km/h in city traffic
    const baseProcessingTime = 30;
    const travelTime = (distance / 20) * 60; // Convert to minutes
    return Math.round(baseProcessingTime + (travelTime * 2)); // Round trip
  }

  /**
   * Get all active vendors
   */
  getActiveVendors(): VendorDetails[] {
    return this.vendors.filter(vendor => vendor.isActive);
  }

  /**
   * Get vendors with distance calculation from pickup location
   */
  getVendorsWithDistance(pickupCoordinates: { lat: number; lng: number }): VendorWithDistance[] {
    const activeVendors = this.getActiveVendors();
    
    return activeVendors
      .map(vendor => {
        const distance = this.calculateDistance(
          pickupCoordinates.lat,
          pickupCoordinates.lng,
          vendor.coordinates.lat,
          vendor.coordinates.lng
        );
        
        const estimatedTime = this.estimateDeliveryTime(distance);
        
        return {
          ...vendor,
          distance,
          estimatedTime
        };
      })
      .sort((a, b) => a.distance - b.distance); // Sort by nearest first
  }

  /**
   * Get vendor by ID
   */
  getVendorById(vendorId: string): VendorDetails | undefined {
    return this.vendors.find(vendor => vendor.id === vendorId);
  }

  /**
   * Parse address to extract approximate coordinates
   * This is a simplified implementation - in production, use a geocoding service
   */
  async getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      console.log('🗺️ Extracting coordinates from address:', address);

      // Handle empty or invalid addresses
      if (!address || typeof address !== 'string') {
        console.log('⚠️ Invalid address provided, using default coordinates');
        return { lat: 28.4595, lng: 77.0266 }; // Default Gurugram coordinates
      }

      // For demo purposes, return coordinates for common Gurugram areas
      const addressLower = address.toLowerCase();

      // Common Gurugram sector coordinates (approximate)
      const sectorCoordinates: Record<string, { lat: number; lng: number }> = {
        'sector 69': { lat: 28.3984, lng: 77.0648 },
        'sector 70': { lat: 28.3920, lng: 77.0580 },
        'sector 71': { lat: 28.3890, lng: 77.0520 },
        'sector 14': { lat: 28.4595, lng: 77.0266 },
        'sector 25': { lat: 28.4949, lng: 77.0828 },
        'sector 54': { lat: 28.4211, lng: 77.0869 },
        'sector 15': { lat: 28.4650, lng: 77.0300 },
        'sector 44': { lat: 28.4400, lng: 77.0500 },
        'sector 50': { lat: 28.4250, lng: 77.0600 },
        'sector 56': { lat: 28.4150, lng: 77.0750 },
        'sector 43': { lat: 28.4450, lng: 77.0480 },
        'sector 32': { lat: 28.4750, lng: 77.0650 },
        'cyber city': { lat: 28.4949, lng: 77.0828 },
        'mg road': { lat: 28.4595, lng: 77.0266 },
        'golf course road': { lat: 28.4211, lng: 77.0869 },
        'sohna road': { lat: 28.4089, lng: 77.0520 },
        'dwarka expressway': { lat: 28.4089, lng: 76.9560 },
        'gurgaon': { lat: 28.4595, lng: 77.0266 },
        'gurugram': { lat: 28.4595, lng: 77.0266 },
        'dlf': { lat: 28.4211, lng: 77.0869 },
        'phase': { lat: 28.4700, lng: 77.0800 }
      };

      // Find matching sector/area
      for (const [area, coords] of Object.entries(sectorCoordinates)) {
        if (addressLower.includes(area)) {
          console.log(`📍 Found coordinates for ${area}:`, coords);
          return coords;
        }
      }

      // Try to extract sector number if not found in the predefined list
      const sectorMatch = addressLower.match(/sector[\s\-]*([0-9]+)/);
      if (sectorMatch) {
        const sectorNum = parseInt(sectorMatch[1]);
        console.log(`📍 Extracting coordinates for Sector ${sectorNum}`);

        // Generate approximate coordinates based on sector number
        // Gurugram sectors are roughly arranged in a grid pattern
        const baseLat = 28.4595;
        const baseLng = 77.0266;
        const latOffset = (sectorNum % 10) * 0.008; // Approximate 800m per sector
        const lngOffset = Math.floor(sectorNum / 10) * 0.008;

        const estimatedCoords = {
          lat: baseLat + latOffset,
          lng: baseLng + lngOffset
        };

        console.log(`📍 Estimated coordinates for Sector ${sectorNum}:`, estimatedCoords);
        return estimatedCoords;
      }

      // Default coordinates for Gurugram city center
      console.log('📍 Using default Gurugram coordinates for address:', address);
      return { lat: 28.4595, lng: 77.0266 };
      
    } catch (error) {
      console.error('Error getting coordinates from address:', error);
      // Always return default coordinates instead of null to prevent distance calculation failures
      console.log('📍 Returning default Gurugram coordinates due to error');
      return { lat: 28.4595, lng: 77.0266 };
    }
  }

  /**
   * Get vendor recommendations for an order
   */
  async getVendorRecommendations(
    pickupAddress: string,
    serviceTypes: string[] = []
  ): Promise<VendorWithDistance[]> {
    console.log('🏪 Getting vendor recommendations for address:', pickupAddress);

    // Get coordinates from address - now always returns coordinates
    const coordinates = await this.getCoordinatesFromAddress(pickupAddress);

    if (!coordinates) {
      console.warn('❌ Could not determine coordinates for address, using defaults:', pickupAddress);
      // This should not happen now, but keep as fallback
      return this.getActiveVendors().map(vendor => ({
        ...vendor,
        distance: 0,
        estimatedTime: 60 // Default 1 hour
      }));
    }

    console.log('✅ Using coordinates for vendor distance calculation:', coordinates);

    // Get vendors with distance
    const vendorsWithDistance = this.getVendorsWithDistance(coordinates);

    console.log('📊 Calculated vendor distances:', vendorsWithDistance.map(v => ({ name: v.name, distance: v.distance })));

    // Filter by service types if specified
    if (serviceTypes.length > 0) {
      const filtered = vendorsWithDistance.filter(vendor =>
        serviceTypes.some(service =>
          vendor.services.some(vendorService =>
            vendorService.toLowerCase().includes(service.toLowerCase())
          )
        )
      );
      console.log('🔍 Filtered vendors by service type:', serviceTypes, 'Result count:', filtered.length);
      return filtered;
    }

    return vendorsWithDistance;
  }

  /**
   * Format distance for display
   */
  formatDistance(distance: number): string {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance}km`;
  }

  /**
   * Format estimated time for display
   */
  formatEstimatedTime(estimatedTime: number): string {
    if (estimatedTime < 60) {
      return `${estimatedTime} mins`;
    }
    const hours = Math.floor(estimatedTime / 60);
    const minutes = estimatedTime % 60;
    
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }
}

export const vendorService = VendorService.getInstance();
