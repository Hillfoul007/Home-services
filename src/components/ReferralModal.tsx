import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SimpleReferModal from "./SimpleReferModal";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
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
            referralCode={currentUser?.referral_code}
            userHasCompletedFirstOrder={true} // Simplification: feature is unlocked for all users who are logged in
            referredCount={currentUser?.referral_stats?.total_referrals || 0}
            earnings={currentUser?.referral_stats?.earned_amount || 0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferralModal;
