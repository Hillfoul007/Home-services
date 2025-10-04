import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Clock,
  Palette,
  Shield,
  MessageSquare,
  Save,
  Volume2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UserService from "@/services/userService";

interface Preferences {
  notifications: {
    push: boolean;
    sms: boolean;
    email: boolean;
    orderUpdates: boolean;
    promotions: boolean;
  };
  scheduling: {
    preferredTimeSlot: string;
    reminderTime: string;
    autoRebook: boolean;
  };
  privacy: {
    shareLocation: boolean;
    dataCollection: boolean;
    personalizedAds: boolean;
  };
  communication: {
    language: string;
    communicationMethod: string;
  };
  theme: {
    darkMode: boolean;
    colorScheme: string;
  };
}

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [preferences, setPreferences] = useState<Preferences>({
    notifications: {
      push: true,
      sms: true,
      email: false,
      orderUpdates: true,
      promotions: false,
    },
    scheduling: {
      preferredTimeSlot: "morning",
      reminderTime: "1hour",
      autoRebook: false,
    },
    privacy: {
      shareLocation: true,
      dataCollection: false,
      personalizedAds: false,
    },
    communication: {
      language: "english",
      communicationMethod: "sms",
    },
    theme: {
      darkMode: false,
      colorScheme: "green",
    },
  });

  const { toast } = useToast();
  const userService = UserService.getInstance();

  useEffect(() => {
    if (currentUser?.phone) {
      loadPreferences();
    }
  }, [currentUser?.phone]);

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem(`preferences_${currentUser.phone}`);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  const savePreferences = async (newPreferences: Preferences) => {
    try {
      const success = await userService.saveUserPreferences(
        currentUser.phone,
        newPreferences,
      );
      if (success) {
        setPreferences(newPreferences);
        // Also save to localStorage as backup
        try {
          localStorage.setItem(
            `preferences_${currentUser.phone}`,
            JSON.stringify(newPreferences),
          );
        } catch (localError) {
          console.warn(
            "Failed to save preferences to localStorage:",
            localError,
          );
        }
        toast({
          title: "Success",
          description: "Preferences saved successfully",
        });
      } else {
        // If UserService fails, try localStorage only
        try {
          localStorage.setItem(
            `preferences_${currentUser.phone}`,
            JSON.stringify(newPreferences),
          );
          setPreferences(newPreferences);
          toast({
            title: "Success",
            description: "Preferences saved locally",
          });
        } catch (localError) {
          throw new Error("Failed to save preferences");
        }
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updatePreference = (
    section: keyof Preferences,
    key: string,
    value: any,
  ) => {
    const updated = {
      ...preferences,
      [section]: {
        ...preferences[section],
        [key]: value,
      },
    };
    savePreferences(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Shield className="h-5 w-5" />
            Preferences
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor="push-notifications"
                  className="text-sm font-medium leading-tight"
                >
                  Push Notifications
                </Label>
                <Switch
                  id="push-notifications"
                  checked={preferences.notifications.push}
                  onCheckedChange={(checked) =>
                    updatePreference("notifications", "push", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor="sms-notifications"
                  className="text-sm font-medium leading-tight"
                >
                  SMS Notifications
                </Label>
                <Switch
                  id="sms-notifications"
                  checked={preferences.notifications.sms}
                  onCheckedChange={(checked) =>
                    updatePreference("notifications", "sms", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor="email-notifications"
                  className="text-sm font-medium leading-tight"
                >
                  Email Notifications
                </Label>
                <Switch
                  id="email-notifications"
                  checked={preferences.notifications.email}
                  onCheckedChange={(checked) =>
                    updatePreference("notifications", "email", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor="order-updates"
                  className="text-sm font-medium leading-tight"
                >
                  Order Updates
                </Label>
                <Switch
                  id="order-updates"
                  checked={preferences.notifications.orderUpdates}
                  onCheckedChange={(checked) =>
                    updatePreference("notifications", "orderUpdates", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor="promotions"
                  className="text-sm font-medium leading-tight"
                >
                  Promotional Offers
                </Label>
                <Switch
                  id="promotions"
                  checked={preferences.notifications.promotions}
                  onCheckedChange={(checked) =>
                    updatePreference("notifications", "promotions", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferred-time" className="text-sm font-medium">
                  Preferred Time Slot
                </Label>
                <Select
                  value={preferences.scheduling.preferredTimeSlot}
                  onValueChange={(value) =>
                    updatePreference("scheduling", "preferredTimeSlot", value)
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">
                      Morning (8AM - 12PM)
                    </SelectItem>
                    <SelectItem value="afternoon">
                      Afternoon (12PM - 4PM)
                    </SelectItem>
                    <SelectItem value="evening">Evening (4PM - 8PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reminder-time">Reminder Time</Label>
                <Select
                  value={preferences.scheduling.reminderTime}
                  onValueChange={(value) =>
                    updatePreference("scheduling", "reminderTime", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30min">30 minutes before</SelectItem>
                    <SelectItem value="1hour">1 hour before</SelectItem>
                    <SelectItem value="2hours">2 hours before</SelectItem>
                    <SelectItem value="1day">1 day before</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label
                  htmlFor="auto-rebook"
                  className="text-sm font-medium leading-tight"
                >
                  Auto-rebook regular services
                </Label>
                <Switch
                  id="auto-rebook"
                  checked={preferences.scheduling.autoRebook}
                  onCheckedChange={(checked) =>
                    updatePreference("scheduling", "autoRebook", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Communication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Communication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={preferences.communication.language}
                  onValueChange={(value) =>
                    updatePreference("communication", "language", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hindi">Hindi</SelectItem>
                    <SelectItem value="tamil">Tamil</SelectItem>
                    <SelectItem value="telugu">Telugu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="communication-method">
                  Preferred Communication
                </Label>
                <Select
                  value={preferences.communication.communicationMethod}
                  onValueChange={(value) =>
                    updatePreference(
                      "communication",
                      "communicationMethod",
                      value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="call">Phone Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="share-location">
                  Share location for better service
                </Label>
                <Switch
                  id="share-location"
                  checked={preferences.privacy.shareLocation}
                  onCheckedChange={(checked) =>
                    updatePreference("privacy", "shareLocation", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="data-collection">
                  Allow usage data collection
                </Label>
                <Switch
                  id="data-collection"
                  checked={preferences.privacy.dataCollection}
                  onCheckedChange={(checked) =>
                    updatePreference("privacy", "dataCollection", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="personalized-ads">
                  Personalized advertisements
                </Label>
                <Switch
                  id="personalized-ads"
                  checked={preferences.privacy.personalizedAds}
                  onCheckedChange={(checked) =>
                    updatePreference("privacy", "personalizedAds", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode">Dark Mode</Label>
                <Switch
                  id="dark-mode"
                  checked={preferences.theme.darkMode}
                  onCheckedChange={(checked) =>
                    updatePreference("theme", "darkMode", checked)
                  }
                />
              </div>

              <div>
                <Label htmlFor="color-scheme">Color Scheme</Label>
                <Select
                  value={preferences.theme.colorScheme}
                  onValueChange={(value) =>
                    updatePreference("theme", "colorScheme", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="purple">Purple</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
