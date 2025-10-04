/**
 * Authentication utilities for better error handling
 */

export interface UserData {
  _id?: string;
  id?: string;
  phone?: string;
  name?: string;
  full_name?: string;
  email?: string;
}

/**
 * Get current user from various storage locations
 */
export const getCurrentUser = (): UserData | null => {
  try {
    // Check multiple possible storage keys
    const possibleKeys = [
      'current_user',
      'cleancare_user', 
      'user_data',
      'authenticated_user'
    ];

    for (const key of possibleKeys) {
      const userData = localStorage.getItem(key);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed && (parsed._id || parsed.id || parsed.phone)) {
            console.log(`✅ Found user data in ${key}:`, parsed);
            return parsed;
          }
        } catch (error) {
          console.warn(`Failed to parse ${key}:`, error);
        }
      }
    }

    // Check auth token for user info
    const authToken = localStorage.getItem('cleancare_auth_token');
    if (authToken) {
      try {
        const parsed = JSON.parse(authToken);
        if (parsed.userId || parsed.user) {
          console.log('✅ Found user in auth token:', parsed);
          return {
            _id: parsed.userId || parsed.user._id,
            id: parsed.userId || parsed.user.id,
            phone: parsed.phone || parsed.user.phone,
            name: parsed.name || parsed.user.name,
          };
        }
      } catch (error) {
        console.warn('Failed to parse auth token:', error);
      }
    }

    console.warn('❌ No user data found in localStorage');
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get user ID for API calls
 */
export const getUserId = (user?: UserData | null): string | null => {
  const currentUser = user || getCurrentUser();
  
  if (!currentUser) {
    return null;
  }

  // Prefer _id over id over phone
  return currentUser._id || currentUser.id || currentUser.phone || null;
};

/**
 * Check if user is authenticated
 */
export const isUserAuthenticated = (): boolean => {
  const user = getCurrentUser();
  const userId = getUserId(user);
  return userId !== null;
};

/**
 * Get display name for user
 */
export const getUserDisplayName = (user?: UserData | null): string => {
  const currentUser = user || getCurrentUser();
  
  if (!currentUser) {
    return 'Guest';
  }

  return currentUser.name || currentUser.full_name || currentUser.phone || 'User';
};

/**
 * Create a guest session if no user exists (for address functionality)
 */
export const createGuestSession = (): UserData => {
  // Check if there's already a guest session to reuse
  const existingUser = localStorage.getItem('current_user');
  if (existingUser) {
    try {
      const parsed = JSON.parse(existingUser);
      if (parsed && parsed.id && parsed.id.startsWith('guest_')) {
        console.log('👤 Reusing existing guest session:', parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse existing user session');
    }
  }

  // Create new guest session only if none exists
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const guestUser: UserData = {
    id: guestId,
    name: 'Guest User',
    phone: '',
  };

  // Store guest session
  localStorage.setItem('current_user', JSON.stringify(guestUser));
  console.log('👤 Created new guest session:', guestUser);

  return guestUser;
};
