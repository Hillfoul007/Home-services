import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  vendorGroupLink?: string;
  reminderType: "pickup" | "delivery";
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  vendorGroupLink,
  reminderType,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      toast.success("Message copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy message");
    });
  };

  const handleOpenWhatsApp = () => {
    if (!vendorGroupLink) {
      toast.error("Vendor WhatsApp group link not available");
      return;
    }

    // Open the WhatsApp group link in a new window
    window.open(vendorGroupLink, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {reminderType === "pickup" ? "📤 Pickup Reminder" : "🚚 Delivery Reminder"}
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message Display */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Message:</p>
            <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
              {message}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {/* Copy Button */}
            <Button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-2 flex-1 ${
                copied
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Message
                </>
              )}
            </Button>

            {/* Open WhatsApp Button */}
            {vendorGroupLink && (
              <Button
                onClick={handleOpenWhatsApp}
                className="flex items-center justify-center gap-2 flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="h-4 w-4" />
                Open WhatsApp
              </Button>
            )}

            {/* Close Button */}
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Close
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Instructions:</strong> Click "Copy Message" to copy the reminder text, then click "Open WhatsApp" to open the vendor's WhatsApp group. Paste the message and send it.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderModal;
