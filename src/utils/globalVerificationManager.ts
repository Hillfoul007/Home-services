// Global verification status manager to ensure rider updates work across all scenarios
class GlobalVerificationManager {
  private static instance: GlobalVerificationManager;
  private verificationStatuses: Map<string, { status: 'pending' | 'approved' | 'rejected', timestamp: number }> = new Map();

  static getInstance(): GlobalVerificationManager {
    if (!GlobalVerificationManager.instance) {
      GlobalVerificationManager.instance = new GlobalVerificationManager();
    }
    return GlobalVerificationManager.instance;
  }

  // Set verification status for an order
  setVerificationStatus(orderId: string, status: 'pending' | 'approved' | 'rejected'): void {
    console.log(`🔄 GlobalVerificationManager: Setting status ${status} for order ${orderId}`);
    
    this.verificationStatuses.set(orderId, {
      status,
      timestamp: Date.now()
    });

    // Also persist to localStorage
    localStorage.setItem(`verification_status_${orderId}`, status);

    // Dispatch global event
    window.dispatchEvent(new CustomEvent('globalVerificationStatusChanged', {
      detail: {
        orderId,
        status,
        timestamp: Date.now()
      }
    }));

    console.log(`✅ GlobalVerificationManager: Status updated and event dispatched`);
  }

  // Get verification status for an order
  getVerificationStatus(orderId: string): { status: 'pending' | 'approved' | 'rejected', timestamp: number } | null {
    const cached = this.verificationStatuses.get(orderId);
    if (cached) {
      return cached;
    }

    // Check localStorage as fallback
    const saved = localStorage.getItem(`verification_status_${orderId}`);
    if (saved) {
      const status = { status: saved as 'pending' | 'approved' | 'rejected', timestamp: Date.now() };
      this.verificationStatuses.set(orderId, status);
      return status;
    }

    return null;
  }

  // Clear verification status for an order
  clearVerificationStatus(orderId: string): void {
    console.log(`🧹 GlobalVerificationManager: Clearing status for order ${orderId}`);
    this.verificationStatuses.delete(orderId);
    localStorage.removeItem(`verification_status_${orderId}`);
    
    window.dispatchEvent(new CustomEvent('globalVerificationStatusChanged', {
      detail: {
        orderId,
        status: null,
        timestamp: Date.now()
      }
    }));
  }

  // Listen for verification completion events and update status
  setupListeners(): void {
    console.log('🎯 GlobalVerificationManager: Setting up listeners');
    
    // Listen for verification completed events from the service
    window.addEventListener('verificationCompleted', (event: CustomEvent) => {
      const { verificationId, approved, verification } = event.detail;
      const orderId = verification?.orderId || verification?.orderData?.orderId;
      
      if (orderId) {
        const status = approved ? 'approved' : 'rejected';
        this.setVerificationStatus(orderId, status);
      }
    });
  }
}

// Initialize global instance and expose to window for debugging
const globalVerificationManager = GlobalVerificationManager.getInstance();
globalVerificationManager.setupListeners();

// Expose to window for debugging
(window as any).globalVerificationManager = globalVerificationManager;

export default globalVerificationManager;
