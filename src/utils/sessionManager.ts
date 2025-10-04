/**
 * Session Manager for handling user sessions and guest users
 */

import { getCurrentUser, getUserId, createGuestSession } from './authUtils';

export interface SessionData {
  isAuthenticated: boolean;
  user: any;
  userId: string | null;
  isGuest: boolean;
}

export class SessionManager {
  private static instance: SessionManager;

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Get current session information
   */
  public getCurrentSession(): SessionData {
    const user = getCurrentUser();
    const userId = getUserId(user);
    const isAuthenticated = userId !== null;
    const isGuest = user ? user.id?.startsWith('guest_') === true : false;

    return {
      isAuthenticated,
      user,
      userId,
      isGuest,
    };
  }

  /**
   * Ensure user has a valid session (create guest if needed)
   */
  public ensureValidSession(): SessionData {
    let session = this.getCurrentSession();

    // If no user session exists, create or reuse guest session
    if (!session.isAuthenticated && !session.userId) {
      console.log('👤 No user session found, ensuring guest session for cart functionality');
      const guestUser = createGuestSession();
      session = {
        isAuthenticated: true, // Guest sessions count as "authenticated" for cart purposes
        user: guestUser,
        userId: getUserId(guestUser),
        isGuest: true,
      };
    }

    return session;
  }

  /**
   * Check if current session can use address functionality
   */
  public canUseAddresses(): boolean {
    const session = this.getCurrentSession();
    return session.isAuthenticated || session.userId !== null;
  }

  /**
   * Get session for address operations
   */
  public getAddressSession(): { user: any; userId: string } | null {
    const session = this.ensureValidSession();
    
    if (session.userId) {
      return {
        user: session.user,
        userId: session.userId,
      };
    }

    return null;
  }

  /**
   * Clear current session
   */
  public clearSession(): void {
    localStorage.removeItem('current_user');
    localStorage.removeItem('cleancare_user');
    localStorage.removeItem('cleancare_auth_token');
    console.log('🧹 Session cleared');
  }

  /**
   * Check if user should be prompted to login
   */
  public shouldPromptLogin(): boolean {
    const session = this.getCurrentSession();
    return !session.isAuthenticated && !session.isGuest;
  }
}
