import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { User, Phone, Edit3, Save, X } from "lucide-react";
import { DVHostingSmsService } from "@/services/dvhostingSmsService";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUserUpdate: (updatedUser: any) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || currentUser?.full_name || "",
    phone: currentUser?.phone || "",
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      const authService = DVHostingSmsService.getInstance();
      const updatedUser = {
        ...currentUser,
        name: formData.name.trim(),
        full_name: formData.name.trim(),
      };

      // Update in localStorage
      authService.setCurrentUser(updatedUser);

      // Try to update in backend if available
      try {
        const response = await fetch("/api/auth/save-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: currentUser.phone,
            full_name: formData.name.trim(),
            name: formData.name.trim(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.user) {
            authService.setCurrentUser(result.user);
            onUserUpdate(result.user);
          }
        }
      } catch (error) {
        console.warn("Backend update failed:", error);
      }

      onUserUpdate(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser?.name || currentUser?.full_name || "",
      phone: currentUser?.phone || "",
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            User Profile
          </DialogTitle>
          <DialogDescription>Manage your profile information</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            {isEditing ? (
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter your full name"
                required
              />
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="font-medium">
                  {currentUser?.name || currentUser?.full_name || "Not set"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="p-2"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex items-center p-3 bg-gray-50 rounded-md">
              <Phone className="h-4 w-4 text-gray-500 mr-2" />
              <span className="font-mono">+91 {currentUser?.phone}</span>
              <span className="ml-auto text-xs text-gray-500">Verified</span>
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={isLoading || !formData.name.trim()}
                className="flex-1"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}

          {!isEditing && (
            <div className="pt-4">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
