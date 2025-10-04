// Debug utility to check verification system state
export const debugVerificationSystem = () => {
  console.log('🔍 === VERIFICATION SYSTEM DEBUG ===');
  
  // Check localStorage
  const pendingKey = 'customer_pending_verifications';
  const processedKey = 'customer_processed_verifications';
  
  const pendingRaw = localStorage.getItem(pendingKey);
  const processedRaw = localStorage.getItem(processedKey);
  
  console.log('📦 Raw pending verifications in localStorage:', pendingRaw);
  console.log('📦 Raw processed verifications in localStorage:', processedRaw);
  
  try {
    const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
    const processed = processedRaw ? JSON.parse(processedRaw) : [];
    
    console.log('📋 Parsed pending verifications:', pending);
    console.log('📋 Parsed processed verifications:', processed);
    
    // Check if there are any pending verifications
    if (Array.isArray(pending) && pending.length > 0) {
      console.log('✅ Found', pending.length, 'pending verification(s)');
      pending.forEach((v, index) => {
        console.log(`📄 Verification ${index + 1}:`, v);
      });
    } else {
      console.log('❌ No pending verifications found');
    }
  } catch (error) {
    console.error('💥 Error parsing verification data:', error);
  }
  
  // Check DOM elements
  const verificationButtons = document.querySelectorAll('[data-testid="verification-button"], button[aria-label*="verification"], button[title*="verification"]');
  console.log('🎯 Found verification buttons in DOM:', verificationButtons.length);
  verificationButtons.forEach((btn, index) => {
    console.log(`🔘 Button ${index + 1}:`, btn);
  });
  
  // Check for dialogs
  const dialogs = document.querySelectorAll('[data-radix-dialog-content], [role="dialog"]');
  console.log('💬 Found dialogs in DOM:', dialogs.length);
  dialogs.forEach((dialog, index) => {
    console.log(`💬 Dialog ${index + 1}:`, dialog);
  });
  
  console.log('🔍 === END DEBUG ===');
};

// Add to window for easy access
if (typeof window !== 'undefined') {
  (window as any).debugVerification = debugVerificationSystem;
}
