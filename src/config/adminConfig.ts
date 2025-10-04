// Admin Configuration
// ==================
// EASILY EDITABLE ADMIN CREDENTIALS
// You can change these credentials anytime by editing this file

export const ADMIN_CONFIG = {
  // Admin Login Credentials (Change these as needed)
  USERNAME: "admin",
  PASSWORD: "admin123!",
  
  // Session Settings
  SESSION_DURATION: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
  
  // Admin Features Access Control
  FEATURES: {
    BOOKING_MANAGEMENT: true,
    USER_BOOKING: true,
    SERVICE_LOCATIONS: true,
    USER_MANAGEMENT: true,
    ANALYTICS: true,
  },
  
  // Admin Portal Settings
  PORTAL_TITLE: "Laundrify Admin Portal",
  THEME: "dark", // "light" or "dark"
};

// Admin Authentication Helper
export class AdminAuth {
  private static readonly STORAGE_KEY = "admin_session";
  
  static authenticate(username: string, password: string): boolean {
    return username === ADMIN_CONFIG.USERNAME && password === ADMIN_CONFIG.PASSWORD;
  }
  
  static isLoggedIn(): boolean {
    const session = this.getSession();
    if (!session) return false;
    
    const now = Date.now();
    const isValid = now < session.expiresAt;
    
    if (!isValid) {
      this.logout();
    }
    
    return isValid;
  }
  
  static login(username: string, password: string): boolean {
    if (this.authenticate(username, password)) {
      const session = {
        username,
        loginTime: Date.now(),
        expiresAt: Date.now() + ADMIN_CONFIG.SESSION_DURATION,
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
      return true;
    }
    return false;
  }
  
  static logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
  
  static getSession(): { username: string; loginTime: number; expiresAt: number } | null {
    try {
      const sessionData = localStorage.getItem(this.STORAGE_KEY);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch {
      return null;
    }
  }
  
  static getRemainingTime(): number {
    const session = this.getSession();
    if (!session) return 0;
    
    const remaining = session.expiresAt - Date.now();
    return Math.max(0, remaining);
  }
}
