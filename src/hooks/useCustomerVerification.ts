import { useState, useEffect, useCallback } from 'react';
import CustomerVerificationService, { PendingVerification } from '@/services/customerVerificationService';
import { DVHostingSmsService } from '@/services/dvhostingSmsService';

export const useCustomerVerification = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentVerification, setCurrentVerification] = useState<PendingVerification | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasCheckedOnStartup, setHasCheckedOnStartup] = useState(false);
  
  const verificationService = CustomerVerificationService.getInstance();

  // Update pending count
  const updatePendingCount = useCallback(() => {
    const count = verificationService.getPendingVerifications().length;
    setPendingCount(count);
    console.log(`📊 Pending verifications count: ${count}`);
  }, []);

  // Check for pending verifications
  const checkPendingVerifications = useCallback(async () => {
    try {
      console.log('🔍 Checking for pending verifications...');

      // Only refresh from backend if we haven't checked recently (prevents infinite calls)
      const lastCheck = localStorage.getItem('lastVerificationCheck');
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      if (!lastCheck || parseInt(lastCheck) < fiveMinutesAgo) {
        await verificationService.refreshVerifications();
        localStorage.setItem('lastVerificationCheck', now.toString());
      } else {
        console.log('⏭️ Skipping backend check - too recent');
      }

      const pending = verificationService.getNextPendingVerification();
      updatePendingCount();

      if (pending) {
        console.log('📋 Found pending verification:', pending.id);
        setCurrentVerification(pending);
        return true;
      } else {
        console.log('✅ No pending verifications found');
        setCurrentVerification(null);
        return false;
      }
    } catch (error) {
      console.error('❌ Error checking pending verifications:', error);
      // Just update local count on error, don't fail completely
      updatePendingCount();
      return false;
    }
  }, [updatePendingCount]);

  // Show verification popup
  const showVerificationPopup = useCallback((verification?: PendingVerification) => {
    if (verification) {
      setCurrentVerification(verification);
    } else {
      const next = verificationService.getNextPendingVerification();
      setCurrentVerification(next);
    }
    setIsPopupOpen(true);
    console.log('📱 Showing verification popup');
  }, []);

  // Hide verification popup
  const hideVerificationPopup = useCallback(() => {
    setIsPopupOpen(false);
    setCurrentVerification(null);
    console.log('📱 Hiding verification popup');
  }, []);

  // Check for verifications on app startup
  const checkOnStartup = useCallback(async () => {
    if (hasCheckedOnStartup) return;
    
    console.log('🚀 Checking for pending verifications on app startup...');
    
    // Ensure user is authenticated before checking
    const authService = DVHostingSmsService.getInstance();
    const currentUser = authService.getCurrentUser();
    
    if (!currentUser) {
      console.log('ℹ️ No authenticated user, skipping verification check');
      setHasCheckedOnStartup(true);
      return;
    }

    try {
      const hasPending = await checkPendingVerifications();
      
      if (hasPending) {
        // Delay showing popup to ensure app is fully loaded
        setTimeout(() => {
          showVerificationPopup();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error checking verifications on startup:', error);
    } finally {
      setHasCheckedOnStartup(true);
    }
  }, [hasCheckedOnStartup, checkPendingVerifications, showVerificationPopup]);

  // Handle verification completion
  const handleVerificationComplete = useCallback((approved: boolean, verificationId: string) => {
    console.log(`✅ Verification completed: ${verificationId} - ${approved ? 'APPROVED' : 'REJECTED'}`);
    
    updatePendingCount();
    
    // Check if there are more verifications
    const next = verificationService.getNextPendingVerification();
    if (next && next.id !== verificationId) {
      setCurrentVerification(next);
      // Keep popup open for next verification
    } else {
      hideVerificationPopup();
    }
  }, [updatePendingCount, hideVerificationPopup]);


  // Listen for verification events
  useEffect(() => {
    const handleNewVerification = (event: CustomEvent) => {
      console.log('📢 New verification pending event:', event.detail);
      updatePendingCount();
      
      // Auto-show popup if not already open
      if (!isPopupOpen) {
        showVerificationPopup(event.detail.verification);
      }
    };

    const handleVerificationCompleted = (event: CustomEvent) => {
      console.log('📢 Verification completed event:', event.detail);
      updatePendingCount();
    };

    window.addEventListener('newVerificationPending', handleNewVerification as EventListener);
    window.addEventListener('verificationCompleted', handleVerificationCompleted as EventListener);

    return () => {
      window.removeEventListener('newVerificationPending', handleNewVerification as EventListener);
      window.removeEventListener('verificationCompleted', handleVerificationCompleted as EventListener);
    };
  }, [isPopupOpen, showVerificationPopup, updatePendingCount]);

  // Check for verifications periodically (reduced frequency to prevent infinite refreshing)
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasCheckedOnStartup) {
        // Only check if user is actually active on the page
        if (document.visibilityState === 'visible') {
          checkPendingVerifications();
        }
      }
    }, 300000); // Check every 5 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, [hasCheckedOnStartup, checkPendingVerifications]);

  // Initial count update
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  return {
    // State
    isPopupOpen,
    currentVerification,
    pendingCount,
    hasCheckedOnStartup,
    
    // Actions
    showVerificationPopup,
    hideVerificationPopup,
    checkOnStartup,
    checkPendingVerifications,
    handleVerificationComplete,

    // Service access
    verificationService
  };
};

export default useCustomerVerification;
