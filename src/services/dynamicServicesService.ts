import { LaundryService, ServiceCategory } from "@/data/laundryServices";

export interface DynamicLaundryService {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  unit: string;
  description?: string;
  minQuantity?: number;
  icon?: string;
  image?: string;
  popular?: boolean;
  enabled?: boolean;
}

export interface DynamicServiceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  enabled?: boolean;
  services: DynamicLaundryService[];
}

class DynamicServicesService {
  private static instance: DynamicServicesService;
  private cache: DynamicServiceCategory[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

  static getInstance(): DynamicServicesService {
    if (!DynamicServicesService.instance) {
      DynamicServicesService.instance = new DynamicServicesService();
    }
    return DynamicServicesService.instance;
  }

  private constructor() {
    this.initializeDefaultServices();
  }

  private initializeDefaultServices() {
    // Initialize with default services from the existing data
    // This serves as fallback when external sources are unavailable
    this.cache = [];
  }

  async getServices(): Promise<DynamicServiceCategory[]> {
    const now = Date.now();

    // Return cached data if still fresh
    if (this.cache.length > 0 && now - this.lastFetch < this.CACHE_DURATION) {
      return this.cache;
    }

    // Check if we're in a hosted environment where backend calls should be skipped
    const isHostedEnv = this.isHostedEnvironment();

    if (isHostedEnv) {
      console.log("🌐 Hosted environment detected - using static services");
      await this.loadStaticFallback();
      return this.cache;
    }

    // Google Sheets integration removed - using static data only
    await this.loadStaticFallback();

    return this.cache;
  }

  private isHostedEnvironment(): boolean {
    return (
      window.location.hostname.includes("fly.dev") ||
      window.location.hostname.includes("builder.codes") ||
      window.location.hostname.includes("vercel.app") ||
      window.location.hostname.includes("netlify.app")
    );
  }

  // Google Sheets integration removed

  private async loadStaticFallback(): Promise<void> {
    // Import static services as fallback
    const { laundryServices } = await import("@/data/laundryServices");

    // Convert static services to dynamic format
    this.cache = laundryServices.map((category) => ({
      ...category,
      enabled: true,
      services: category.services.map((service) => ({
        ...service,
        enabled: true,
      })),
    }));

    this.lastFetch = Date.now();
    console.log("��� Loaded static services as fallback");
  }

  async refreshServices(): Promise<DynamicServiceCategory[]> {
    this.lastFetch = 0; // Force refresh
    return this.getServices();
  }

  // Helper methods to match existing API
  async getServiceById(id: string): Promise<DynamicLaundryService | undefined> {
    const services = await this.getServices();
    for (const category of services) {
      const service = category.services.find(
        (s) => s.id === id && s.enabled !== false,
      );
      if (service) return service;
    }
    return undefined;
  }

  async getServicesByCategory(
    categoryId: string,
  ): Promise<DynamicLaundryService[]> {
    const services = await this.getServices();
    const category = services.find(
      (c) => c.id === categoryId && c.enabled !== false,
    );
    return category ? category.services.filter((s) => s.enabled !== false) : [];
  }

  async getPopularServices(): Promise<DynamicLaundryService[]> {
    const services = await this.getServices();
    const popular: DynamicLaundryService[] = [];

    services.forEach((category) => {
      if (category.enabled !== false) {
        popular.push(
          ...category.services.filter((s) => s.popular && s.enabled !== false),
        );
      }
    });

    return popular.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSortedServices(): Promise<DynamicLaundryService[]> {
    const services = await this.getServices();
    const allServices: DynamicLaundryService[] = [];

    services.forEach((category) => {
      if (category.enabled !== false) {
        allServices.push(
          ...category.services.filter((s) => s.enabled !== false),
        );
      }
    });

    const popular = allServices
      .filter((s) => s.popular)
      .sort((a, b) => a.name.localeCompare(b.name));
    const regular = allServices
      .filter((s) => !s.popular)
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...popular, ...regular];
  }

  async searchServices(query: string): Promise<DynamicLaundryService[]> {
    const services = await this.getServices();
    const searchTerm = query.toLowerCase();
    const results: DynamicLaundryService[] = [];

    services.forEach((category) => {
      if (category.enabled !== false) {
        category.services.forEach((service) => {
          if (
            service.enabled !== false &&
            (service.name.toLowerCase().includes(searchTerm) ||
              service.category.toLowerCase().includes(searchTerm) ||
              service.description?.toLowerCase().includes(searchTerm))
          ) {
            results.push(service);
          }
        });
      }
    });

    return results;
  }

  // Admin methods for updating services (if needed)
  async updateService(
    serviceId: string,
    updates: Partial<DynamicLaundryService>,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.BACKEND_URL}/api/services/${serviceId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        },
      );

      if (response.ok) {
        await this.refreshServices();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to update service:", error);
      return false;
    }
  }

  // Clear cache manually
  clearCache(): void {
    this.cache = [];
    this.lastFetch = 0;
  }
}

export default DynamicServicesService;
