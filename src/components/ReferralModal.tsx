import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SimpleReferModal from "./SimpleReferModal";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";
import { getApiUrl } from "@/config/env";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  currentUser: initialUser,
}) => {
  const [user, setUser] = React.useState(initialUser);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    // Always refresh user data from backend when modal opens
    // This ensures has_completed_first_order and referral_code are up to date
    const refreshUserData = async () => {
      if (isOpen && initialUser?.phone) {
        setIsLoading(true);
        try {
          const apiBaseUrl = getApiUrl();
          const cleanPhone = initialUser.phone.replace(/\D/g, '').slice(-10);
          const response = await fetch(`${apiBaseUrl}/auth/get-user-by-phone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: cleanPhone }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.user) {
              setUser(result.user);
              // Also update localStorage so the rest of the app sees the fresh data
              const dvService = DVHostingSmsService.getInstance();
              const updatedUser = { ...initialUser, ...result.user };
              dvService.setCurrentUser(updatedUser);
            } else {
              setUser(initialUser);
            }
          } else {
            setUser(initialUser);
          }
        } catch (error) {
          console.error("Failed to refresh user for referral:", error);
          setUser(initialUser);
        } finally {
          setIsLoading(false);
        }
      }
    };

    refreshUserData();
  }, [isOpen, initialUser?.phone]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            🎁 Refer and Earn
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-0">
          <SimpleReferModal
            referralCode={user?.referral_code}
            userHasCompletedFirstOrder={user?.has_completed_first_order === true}
            referredCount={user?.referral_stats?.total_referrals || 0}
            earnings={user?.referral_stats?.earned_amount || 0}
          />
          {isLoading && (
            <div className="text-center py-2">
              <p className="text-xs text-gray-500 animate-pulse">Refreshing your code...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferralModal;
