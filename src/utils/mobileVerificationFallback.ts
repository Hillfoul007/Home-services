/**
 * Mobile verification fallback system
 * This provides an alternative way to show verification alerts on mobile
 * if the popup system fails to work properly
 */

let fallbackCheckInterval: NodeJS.Timeout | null = null;
let lastNotificationTime = 0;

export function initializeMobileVerificationFallback() {
  // Only run on mobile devices
  if (typeof window === 'undefined' || window.innerWidth >= 768) {
    return;
  }

  console.log('📱 Initializing mobile verification fallback system');

  // Add event listeners for verification events
  window.addEventListener('showVerificationPopup', handleShowVerificationPopup);
  window.addEventListener('newVerificationPending', handleNewVerificationPending);

  // Check for pending verifications every 2 minutes (reduced from 10 seconds to prevent infinite refreshing)
  // Also only check when page is visible
  fallbackCheckInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkAndShowFallbackNotification();
    }
  }, 120000); // 2 minutes

  // Also check immediately after a delay
  setTimeout(checkAndShowFallbackNotification, 3000);
}

function handleShowVerificationPopup(event: Event) {
  console.log('📱 Fallback: Received showVerificationPopup event');

  // Try to trigger the verification popup through the hook
  setTimeout(() => {
    const existingPopup = document.querySelector('[data-radix-dialog-content]');
    if (!existingPopup) {
      console.log('📱 Fallback: No popup visible, forcing manual verification check');
      checkAndShowFallbackNotification();
    }
  }, 1000);
}

function handleNewVerificationPending(event: Event) {
  console.log('📱 Fallback: New verification pending event received');
  setTimeout(checkAndShowFallbackNotification, 2000);
}

export function cleanupMobileVerificationFallback() {
  if (fallbackCheckInterval) {
    clearInterval(fallbackCheckInterval);
    fallbackCheckInterval = null;
  }

  // Remove event listeners
  window.removeEventListener('showVerificationPopup', handleShowVerificationPopup);
  window.removeEventListener('newVerificationPending', handleNewVerificationPending);
}

function checkAndShowFallbackNotification() {
  try {
    // Check localStorage for pending verifications
    const pendingKey = 'customer_pending_verifications';
    const pendingRaw = localStorage.getItem(pendingKey);
    
    if (!pendingRaw) return;
    
    const pending = JSON.parse(pendingRaw);
    if (!Array.isArray(pending) || pending.length === 0) return;

    // Check if we recently showed a notification (throttle)
    const now = Date.now();
    if (now - lastNotificationTime < 30000) return; // 30 seconds throttle

    console.log('📱 Fallback: Found pending verifications on mobile, checking if popup is visible...');

    // Check if the verification popup is actually visible
    const dialogContent = document.querySelector('[data-radix-dialog-content]');
    const isPopupVisible = dialogContent && 
      window.getComputedStyle(dialogContent).display !== 'none' &&
      window.getComputedStyle(dialogContent).visibility !== 'hidden';

    if (!isPopupVisible) {
      console.log('📱 Fallback: Popup not visible, showing fallback notification');
      showFallbackNotification(pending.length);
      lastNotificationTime = now;
    } else {
      console.log('📱 Fallback: Popup is visible, no action needed');
    }
  } catch (error) {
    console.error('📱 Fallback: Error checking verification status:', error);
  }
}

function showFallbackNotification(count: number) {
  // Create a highly visible notification overlay
  const existingOverlay = document.getElementById('mobile-verification-fallback');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'mobile-verification-fallback';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ef4444;
    color: white;
    padding: 16px;
    text-align: center;
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideDown 0.3s ease-out;
  `;

  overlay.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
      <span style="font-size: 18px;">🔔</span>
      <span>${count} Order Change${count > 1 ? 's' : ''} Need Your Approval</span>
      <button 
        id="fallback-review-btn"
        style="
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: 600;
          margin-left: 8px;
          cursor: pointer;
        "
      >
        Review Now
      </button>
      <button 
        id="fallback-close-btn"
        style="
          background: transparent;
          border: none;
          color: white;
          padding: 8px;
          margin-left: 8px;
          cursor: pointer;
          font-size: 18px;
        "
      >
        ×
      </button>
    </div>
  `;

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(overlay);

  // Add event listeners
  const reviewBtn = overlay.querySelector('#fallback-review-btn');
  const closeBtn = overlay.querySelector('#fallback-close-btn');

  reviewBtn?.addEventListener('click', () => {
    console.log('📱 Fallback: Review button clicked');
    
    // Try to trigger the verification popup
    const event = new CustomEvent('showVerificationPopup', {
      detail: { source: 'fallback' }
    });
    window.dispatchEvent(event);

    // Also try to force show popup through direct service call
    try {
      const CustomerVerificationService = (window as any).CustomerVerificationService;
      if (CustomerVerificationService) {
        const instance = CustomerVerificationService.getInstance();
        const verification = instance.getNextPendingVerification();
        if (verification) {
          // Force show popup
          const showEvent = new CustomEvent('openVerificationPopup', {
            detail: { verification }
          });
          window.dispatchEvent(showEvent);
        }
      }
    } catch (error) {
      console.error('📱 Fallback: Error triggering popup:', error);
    }

    overlay.remove();
  });

  closeBtn?.addEventListener('click', () => {
    overlay.remove();
  });

  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 15000);

  console.log('📱 Fallback: Notification overlay created');
}

// Initialize immediately if on mobile
if (typeof window !== 'undefined' && window.innerWidth < 768) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeMobileVerificationFallback, 1000);
    });
  } else {
    setTimeout(initializeMobileVerificationFallback, 1000);
  }
}

export default {
  initializeMobileVerificationFallback,
  cleanupMobileVerificationFallback
};
