/**
 * Debug utility specifically for mobile verification banner issue
 */

export function debugMobileVerificationBanner() {
  console.log('🔍 === Mobile Verification Banner Debug ===');
  
  // Check screen size
  const isMobile = window.innerWidth < 768;
  console.log('📱 Is Mobile:', isMobile);
  console.log('📐 Screen size:', window.innerWidth, 'x', window.innerHeight);
  
  // Check localStorage for verifications
  const pendingKey = 'customer_pending_verifications';
  const pendingRaw = localStorage.getItem(pendingKey);
  
  console.log('💾 Raw pending verifications:', pendingRaw);
  
  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw);
      console.log('📋 Parsed pending verifications:', pending);
      console.log('📊 Pending count:', pending.length);
      
      if (Array.isArray(pending) && pending.length > 0) {
        console.log('✅ Found pending verifications:');
        pending.forEach((v, i) => {
          console.log(`  ${i + 1}. ID: ${v.id}, Type: ${v.type}, Priority: ${v.priority}`);
        });
      } else {
        console.log('❌ No pending verifications found');
      }
    } catch (error) {
      console.error('❌ Error parsing pending verifications:', error);
    }
  } else {
    console.log('❌ No pending verifications in localStorage');
  }
  
  // Check if banner element exists in DOM
  const bannerElements = document.querySelectorAll('[class*="bg-red-500"]');
  console.log('🔴 Red banner elements found:', bannerElements.length);
  
  bannerElements.forEach((el, i) => {
    const styles = window.getComputedStyle(el);
    console.log(`  Banner ${i + 1}:`, {
      display: styles.display,
      visibility: styles.visibility,
      position: styles.position,
      zIndex: styles.zIndex,
      top: styles.top
    });
  });
  
  // Check if the component is rendering properly
  const headerElements = document.querySelectorAll('[class*="bg-gradient-to-r"]');
  console.log('📱 Header elements found:', headerElements.length);
  
  console.log('🔍 === End Debug ===');
}

// Auto-run on mobile
if (typeof window !== 'undefined' && window.innerWidth < 768) {
  setTimeout(debugMobileVerificationBanner, 2000);
}

export default debugMobileVerificationBanner;
