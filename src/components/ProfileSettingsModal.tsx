import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Edit,
  Save,
  X,
  LogOut,
  Gift,
  Copy,
  MapPin,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import UserService from "@/services/userService";
import SavedAddressesModal from "./SavedAddressesModal";

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUpdateProfile: (updatedUser: any) => void;
  onLogout?: () => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  });
  const { toast } = useToast();
  const userService = UserService.getInstance();



  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedUser = await userService.updateUser(
        currentUser.phone,
        formData,
      );
      if (updatedUser) {
        onUpdateProfile(updatedUser);
        setIsEditing(false);
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      phone: currentUser?.phone || "",
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[95vw] mx-4 sm:mx-auto border-0 shadow-2xl rounded-3xl overflow-hidden bg-gradient-to-br from-white via-gray-50/50 to-green-50/30 animate-in zoom-in-95 duration-300 fade-in-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center justify-between text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Profile Settings
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-1 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Profile Picture */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-24 w-24 shadow-xl ring-4 ring-green-100 ring-offset-4 ring-offset-white transition-all duration-300 hover:ring-green-200 hover:shadow-2xl">
                <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white text-2xl font-bold">
                  {getInitials(formData.name || "User")}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-8 w-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
                <Edit className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            <div className="group">
              <Label
                htmlFor="name"
                className="text-sm font-semibold text-gray-700 mb-2 block"
              >
                Full Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                disabled={!isEditing}
                className={`transition-all duration-200 rounded-xl border-2 ${
                  !isEditing
                    ? "bg-gray-50/80 border-gray-200 text-gray-600"
                    : "bg-white border-green-200 focus:border-green-400 focus:ring-green-400/20 shadow-sm hover:shadow-md"
                }`}
              />
            </div>

            <div className="group">
              <Label
                htmlFor="phone"
                className="text-sm font-semibold text-gray-700 mb-2 block"
              >
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                disabled={true}
                className="bg-gray-50/80 border-2 border-gray-200 text-gray-600 rounded-xl"
              />
              <p className="text-xs text-gray-500 mt-2 ml-1 flex items-center">
                <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                Phone number cannot be changed
              </p>
            </div>

            <div className="group">
              <Label
                htmlFor="email"
                className="text-sm font-semibold text-gray-700 mb-2 block"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your email address"
                className={`transition-all duration-200 rounded-xl border-2 ${
                  !isEditing
                    ? "bg-gray-50/80 border-gray-200 text-gray-600"
                    : "bg-white border-green-200 focus:border-green-400 focus:ring-green-400/20 shadow-sm hover:shadow-md"
                }`}
              />
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-800 font-semibold py-3 rounded-xl shadow-sm hover:shadow-md transform hover:scale-[1.02] transition-all duration-200"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}





          {/* Logout Button */}
          {onLogout && (
            <div className="pt-6 border-t border-gradient-to-r from-transparent via-gray-200 to-transparent">
              <Button
                onClick={() => {
                  // Use iOS fixes for logout
                  import("../utils/iosAuthFix").then(
                    ({ clearIosAuthState }) => {
                      clearIosAuthState();
                    },
                  );
                  onLogout();
                  onClose();
                }}
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 font-semibold py-3 rounded-xl shadow-sm hover:shadow-md transform hover:scale-[1.02] transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Address Management Modal */}
      <SavedAddressesModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        currentUser={currentUser}
      />
    </Dialog>
  );
};

export default ProfileSettingsModal;
