import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SimpleReferModal from "./SimpleReferModal";
import { UserService } from "@/services/userService";

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
    // Refresh user data if referral code is missing
    const refreshUserData = async () => {
      if (isOpen && initialUser?.phone && !initialUser?.referral_code) {
        setIsLoading(true);
        try {
          const userService = UserService.getInstance();
          const freshUser = await userService.getUser(initialUser.phone);
          if (freshUser) {
            setUser(freshUser);
          }
        } catch (error) {
          console.error("Failed to refresh user for referral code:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (isOpen) {
        setUser(initialUser);
      }
    };

    refreshUserData();
  }, [isOpen, initialUser]);

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
            userHasCompletedFirstOrder={true} 
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
