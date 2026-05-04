/**
 * Vendor Service
 * Handles vendor management and distance calculations
 */

import { locationService } from './locationService';

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
  
  // Static vendor data - will be populated from API
  private vendors: VendorDetails[] = [];

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
   * Set vendors from admin API
   */
  setVendors(vendors: VendorDetails[]): void {
    this.vendors = vendors;
  }

  /**
   * Get all active vendors
   */
  getActiveVendors(): VendorDetails[] {
    return this.vendors.filter(vendor => vendor.isActive !== false);
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
   * Parse address to extract coordinates using Google Maps geocoding
   */
  async getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      console.log('🗺️ Geocoding address:', address);

      // Handle empty or invalid addresses
      if (!address || typeof address !== 'string') {
        console.log('⚠️ Invalid address provided, using default coordinates');
        return { lat: 28.4595, lng: 77.0266 }; // Default Gurugram coordinates
      }

      // Try to geocode the address using Google Maps API
      try {
        const result = await locationService.geocodeAddress(address);
        if (result && result.coordinates) {
          console.log('✅ Geocoded address successfully:', result.coordinates);
          return result.coordinates;
        }
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed, using fallback method:', geocodeError);
      }

      // Fallback: Use simplified address parsing for common Gurugram areas.
      // IMPORTANT: check specific sectors/landmarks FIRST, then try sector-number
      // extraction, and only fall back to the generic city centre last.
      // Previously 'gurugram'/'gurgaon' were in the same loop as specific sectors,
      // so "Sector 104, Gurugram" matched 'gurugram' and returned the city centre
      // before the sector-number extraction could run — producing wrong distances.
      const addressLower = address.toLowerCase();

      // Step 1 — named sectors / landmarks (no city-level keywords here)
      const namedAreaCoordinates: Record<string, { lat: number; lng: number }> = {
        'sector 69': { lat: 28.3984, lng: 77.0648 },
        'sector 70': { lat: 28.3920, lng: 77.0580 },
        'sector 71': { lat: 28.3890, lng: 77.0520 },
        'sector 104': { lat: 28.4020, lng: 76.9756 },
        'sector 105': { lat: 28.4050, lng: 76.9710 },
        'sector 106': { lat: 28.4080, lng: 76.9680 },
        'sector 109': { lat: 28.4100, lng: 76.9640 },
        'sector 110': { lat: 28.4120, lng: 76.9600 },
        'sector 14': { lat: 28.4595, lng: 77.0266 },
        'sector 25': { lat: 28.4949, lng: 77.0828 },
        'sector 54': { lat: 28.4211, lng: 77.0869 },
        'sector 15': { lat: 28.4650, lng: 77.0300 },
        'sector 44': { lat: 28.4400, lng: 77.0500 },
        'sector 50': { lat: 28.4250, lng: 77.0600 },
        'sector 56': { lat: 28.4150, lng: 77.0750 },
        'sector 43': { lat: 28.4450, lng: 77.0480 },
        'sector 32': { lat: 28.4750, lng: 77.0650 },
        'sector 39': { lat: 28.4480, lng: 77.0720 },
        'sector 31': { lat: 28.4680, lng: 77.0680 },
        'sector 28': { lat: 28.4750, lng: 77.0590 },
        'cyber city': { lat: 28.4949, lng: 77.0828 },
        'mg road': { lat: 28.4595, lng: 77.0266 },
        'golf course road': { lat: 28.4211, lng: 77.0869 },
        'sohna road': { lat: 28.4089, lng: 77.0520 },
        'dwarka expressway': { lat: 28.4089, lng: 76.9560 },
        'dlf': { lat: 28.4211, lng: 77.0869 },
      };

      for (const [area, coords] of Object.entries(namedAreaCoordinates)) {
        if (addressLower.includes(area)) {
          console.log(`📍 Found fallback coordinates for ${area}:`, coords);
          return coords;
        }
      }

      // Step 2 — extract any sector number not in the named list above
      const sectorMatch = addressLower.match(/sector[\s\-]*([0-9]+)/);
      if (sectorMatch) {
        const sectorNum = parseInt(sectorMatch[1]);
        console.log(`📍 Estimating coordinates for Sector ${sectorNum}`);

        // Sectors 80–115 are along Dwarka Expressway (SW of old city)
        if (sectorNum >= 80 && sectorNum <= 115) {
          const offset = sectorNum - 80;
          return {
            lat: 28.4400 - offset * 0.003,
            lng: 77.0100 - offset * 0.004,
          };
        }

        // Sectors 57–79 are along Southern Peripheral Road / Golf Course Ext.
        if (sectorNum >= 57 && sectorNum <= 79) {
          const offset = sectorNum - 57;
          return {
            lat: 28.4050 + offset * 0.004,
            lng: 77.0500 + offset * 0.003,
          };
        }

        // Remaining sectors: rough grid around old Gurugram
        return {
          lat: 28.4595 + (sectorNum % 10) * 0.006,
          lng: 77.0266 + Math.floor(sectorNum / 10) * 0.006,
        };
      }

      // Step 3 — city-level fallback (last resort)
      if (addressLower.includes('gurgaon') || addressLower.includes('gurugram')) {
        console.log('📍 Using Gurugram city-centre fallback for address:', address);
        return { lat: 28.4595, lng: 77.0266 };
      }

      // Absolute default
      console.log('📍 Using absolute default coordinates for address:', address);
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
   * @param pickupAddress - The pickup address (used for geocoding if coordinates not provided)
   * @param coordinatesOrServiceTypes - Either coordinates object or service types array (for backward compatibility)
   * @param serviceTypes - Service types to filter by (optional)
   */
  async getVendorRecommendations(
    pickupAddress: string,
    coordinatesOrServiceTypes?: { lat: number; lng: number } | string[] | null,
    serviceTypes?: string[]
  ): Promise<VendorWithDistance[]> {
    console.log('🏪 Getting vendor recommendations for address:', pickupAddress);

    // Handle backward compatibility - detect if second param is coordinates or serviceTypes
    let coordinates: { lat: number; lng: number } | null = null;
    let filterServiceTypes: string[] = [];

    if (coordinatesOrServiceTypes) {
      if (Array.isArray(coordinatesOrServiceTypes)) {
        // It's serviceTypes
        filterServiceTypes = coordinatesOrServiceTypes;
      } else if (typeof coordinatesOrServiceTypes === 'object' && 'lat' in coordinatesOrServiceTypes && 'lng' in coordinatesOrServiceTypes) {
        // It's coordinates
        coordinates = coordinatesOrServiceTypes;
      }
    }

    // Use provided serviceTypes if specified
    if (serviceTypes && Array.isArray(serviceTypes)) {
      filterServiceTypes = serviceTypes;
    }

    // If no coordinates provided, geocode from address
    if (!coordinates) {
      coordinates = await this.getCoordinatesFromAddress(pickupAddress);
      console.log('🗺️ Geocoded address to coordinates:', coordinates);
    } else {
      console.log('✅ Using provided coordinates (likely from Google Maps link):', coordinates);
    }

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
    if (filterServiceTypes.length > 0) {
      const filtered = vendorsWithDistance.filter(vendor =>
        filterServiceTypes.some(service =>
          vendor.services.some(vendorService =>
            vendorService.toLowerCase().includes(service.toLowerCase())
          )
        )
      );
      console.log('🔍 Filtered vendors by service type:', filterServiceTypes, 'Result count:', filtered.length);
      // Return filtered vendors if found, otherwise return all vendors with distance
      return filtered.length > 0 ? filtered : vendorsWithDistance;
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
