/**
 * Debug utility for customer verification system on mobile
 */

export function debugCustomerVerification() {
  console.log('🔍 === Customer Verification Debug Report ===');
  
  // Check if we're on mobile
  const isMobile = window.innerWidth < 768;
  console.log('📱 Is Mobile:', isMobile);
  console.log('📐 Screen dimensions:', window.innerWidth, 'x', window.innerHeight);
  
  // Check localStorage for verification data
  const pendingKey = 'customer_pending_verifications';
  const processedKey = 'customer_processed_verifications';
  
  const pendingRaw = localStorage.getItem(pendingKey);
  const processedRaw = localStorage.getItem(processedKey);
  
  console.log('💾 LocalStorage - Pending verifications raw:', pendingRaw);
  console.log('💾 LocalStorage - Processed verifications raw:', processedRaw);
  
  try {
    const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
    const processed = processedRaw ? JSON.parse(processedRaw) : [];
    
    console.log('📋 Parsed pending verifications:', pending);
    console.log('📋 Parsed processed verifications:', processed);
    
    if (Array.isArray(pending) && pending.length > 0) {
      console.log('✅ Found', pending.length, 'pending verification(s)');
      pending.forEach((v: any, index: number) => {
        console.log(`  ${index + 1}. ${v.id} - ${v.type} - Priority: ${v.priority}`);
      });
    } else {
      console.log('❌ No pending verifications found');
    }
  } catch (error) {
    console.error('❌ Error parsing verification data:', error);
  }
  
  // Check authentication state
  const authToken = localStorage.getItem('cleancare_auth_token');
  const currentUserRaw = localStorage.getItem('cleancare_current_user');
  
  console.log('🔑 Auth token exists:', !!authToken);
  console.log('👤 Current user raw:', currentUserRaw);
  
  try {
    const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
    console.log('👤 Parsed current user:', currentUser);
  } catch (error) {
    console.error('❌ Error parsing current user:', error);
  }
  
  // Check notification permissions
  if ('Notification' in window) {
    console.log('🔔 Notification permission:', Notification.permission);
  } else {
    console.log('❌ Notifications not supported');
  }
  
  // Check if verification service is initialized
  try {
    const CustomerVerificationService = window.CustomerVerificationService;
    if (CustomerVerificationService) {
      console.log('✅ CustomerVerificationService is available');
    } else {
      console.log('❌ CustomerVerificationService not found on window object');
    }
  } catch (error) {
    console.log('❌ Error checking CustomerVerificationService:', error);
  }
  
  // Check if popup is blocked or hidden
  const dialogs = document.querySelectorAll('[data-radix-dialog-content]');
  console.log('🪟 Active dialogs found:', dialogs.length);
  
  dialogs.forEach((dialog, index) => {
    const styles = window.getComputedStyle(dialog);
    console.log(`  Dialog ${index + 1}:`, {
      display: styles.display,
      visibility: styles.visibility,
      zIndex: styles.zIndex,
      position: styles.position,
      transform: styles.transform
    });
  });
  
  // Check for any blocking elements
  const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
  console.log('🖥️ Dialog overlays found:', overlays.length);
  
  // Test viewport meta tag
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  console.log('📱 Viewport meta tag:', viewportMeta ? viewportMeta.getAttribute('content') : 'NOT FOUND');
  
  console.log('🔍 === End Debug Report ===');
}

// Auto-run debug on mobile devices
if (typeof window !== 'undefined' && window.innerWidth < 768) {
  // Delay to ensure app is fully loaded
  setTimeout(debugCustomerVerification, 2000);
}

export default debugCustomerVerification;
