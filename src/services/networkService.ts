export class NetworkService {
  private static instance: NetworkService;
  private onlineStatus: boolean = navigator.onLine;
  private listeners: Array<(isOnline: boolean) => void> = [];
  private lastBackendCheck: number = 0;
  private backendHealthy: boolean = true;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    this.onlineStatus = true;
    this.notifyListeners();
    console.log('🌐 Network connection restored');
  }

  private handleOffline(): void {
    this.onlineStatus = false;
    this.notifyListeners();
    console.log('📱 Network connection lost');
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.onlineStatus));
  }

  public isOnline(): boolean {
    return this.onlineStatus;
  }

  public isBackendHealthy(): boolean {
    return this.backendHealthy;
  }

  public addStatusListener(listener: (isOnline: boolean) => void): void {
    this.listeners.push(listener);
  }

  public removeStatusListener(listener: (isOnline: boolean) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Check if backend is reachable using a lightweight endpoint
   */
  public async checkBackendHealth(apiUrl: string): Promise<boolean> {
    const now = Date.now();

    // Don't check too frequently
    if (now - this.lastBackendCheck < this.HEALTH_CHECK_INTERVAL) {
      return this.backendHealthy;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Use a lightweight endpoint that likely exists
      // Try to hit the base API first, then specific health endpoint
      const endpoints = [`${apiUrl}/riders/notifications/unread-count`, `${apiUrl}/health`];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'HEAD', // Use HEAD to minimize data transfer
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          // Accept any response (even 401/403) as long as server responds
          this.backendHealthy = response.status < 500;
          this.lastBackendCheck = now;

          console.log(this.backendHealthy ? '✅ Backend reachable' : '⚠️ Backend error');
          return this.backendHealthy;
        } catch (endpointError) {
          // Try next endpoint
          continue;
        }
      }

      // If all endpoints fail
      this.backendHealthy = false;
      this.lastBackendCheck = now;
      return false;
    } catch (error) {
      this.backendHealthy = false;
      this.lastBackendCheck = now;
      console.log('❌ Backend health check failed:', error.message);
      return false;
    }
  }

  /**
   * Enhanced fetch with retry logic and error handling
   */
  public async safeFetch(
    url: string, 
    options: RequestInit = {}, 
    retries: number = 2
  ): Promise<Response | null> {
    if (!this.isOnline()) {
      throw new Error('No internet connection');
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = 15000 + (attempt * 5000); // Increase timeout with retries
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`⏰ Request timeout (attempt ${attempt + 1}/${retries + 1})`);
        } else if (error.message?.includes('Failed to fetch')) {
          console.log(`🌐 Network error (attempt ${attempt + 1}/${retries + 1})`);
        }

        // Don't retry on last attempt
        if (attempt === retries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return null;
  }

  /**
   * Get user-friendly error message
   */
  public getErrorMessage(error: any): string {
    if (!this.isOnline()) {
      return 'No internet connection. Please check your network settings.';
    }

    if (error.name === 'AbortError') {
      return 'Request timed out. Please try again.';
    }

    if (error.message?.includes('Failed to fetch')) {
      return 'Unable to connect to server. Please try again later.';
    }

    return 'An unexpected error occurred. Please try again.';
  }
}

export default NetworkService;
