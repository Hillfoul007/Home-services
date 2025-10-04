/**
 * Utility to clear all test and demo verifications from localStorage
 */

export function clearTestVerifications() {
  try {
    console.log('🧹 Clearing test/demo verifications...');
    
    // Get current pending verifications
    const pendingKey = 'customer_pending_verifications';
    const pendingRaw = localStorage.getItem(pendingKey);
    
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw);
      
      // Filter out test/demo verifications
      const filtered = pending.filter((v: any) => {
        const isTest = v.id && (
          v.id.includes('test') || 
          v.id.includes('demo') || 
          v.id.includes('DEMO') || 
          v.id.includes('TEST') || 
          v.id.includes('mobile-test') ||
          v.orderId?.includes('demo') ||
          v.orderId?.includes('test') ||
          v.orderData?.bookingId?.includes('DEMO') ||
          v.orderData?.bookingId?.includes('TEST') ||
          v.orderData?.customerName?.includes('Demo') ||
          v.orderData?.customerName?.includes('Test')
        );
        
        if (isTest) {
          console.log(`🗑️ Removing test verification: ${v.id}`);
          return false;
        }
        
        return true;
      });
      
      console.log(`📋 Filtered ${pending.length - filtered.length} test verifications`);
      
      // Save filtered list back
      localStorage.setItem(pendingKey, JSON.stringify(filtered));
    }
    
    // Also clear processed test verifications
    const processedKey = 'customer_processed_verifications';
    const processedRaw = localStorage.getItem(processedKey);
    
    if (processedRaw) {
      const processed = JSON.parse(processedRaw);
      const filteredProcessed = processed.filter((id: string) => {
        const isTest = id.includes('test') || 
                      id.includes('demo') || 
                      id.includes('DEMO') || 
                      id.includes('TEST');
        return !isTest;
      });
      
      localStorage.setItem(processedKey, JSON.stringify(filteredProcessed));
      console.log(`📋 Cleaned ${processed.length - filteredProcessed.length} processed test verifications`);
    }
    
    console.log('✅ Test verification cleanup completed');
    
    // Dispatch event to refresh any listening components
    window.dispatchEvent(new CustomEvent('verificationsCleared'));
    
  } catch (error) {
    console.error('❌ Error clearing test verifications:', error);
  }
}

// Auto-run cleanup on page load in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  setTimeout(clearTestVerifications, 1000);
}

export default clearTestVerifications;
