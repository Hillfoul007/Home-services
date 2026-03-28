import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Send, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

const AdminPushNotifications: React.FC = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("/");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ 
    sent: number; 
    failed?: number; 
    native?: number; 
    isMock?: boolean;
  } | null>(null);

  const handleSendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message body are required");
      return;
    }

    try {
      setLoading(true);
      setStats(null);
      
      const response = await apiClient.adminRequest<{
        success: boolean;
        sentCount: number;
        nativeCount?: number;
        failedCount?: number;
        mockMode?: boolean;
        error?: string;
      }>("/admin/push-all", {
        method: "POST",
        body: { title, body, route },
      });

      if (response && response.data && response.data.success) {
        if (response.data.mockMode) {
          toast.warning("In-app notifications saved, but native push is DISABLED (Firebase not configured in backend).");
          setStats({ sent: response.data.sentCount, failed: 0, isMock: true });
        } else {
          toast.success(`Successfully sent to ${response.data.sentCount} users and ${response.data.nativeCount || 0} native devices!`);
          setStats({ sent: response.data.sentCount, failed: response.data.failedCount, native: response.data.nativeCount });
        }
        setTitle("");
        setBody("");
      } else {
        toast.error(response?.data?.error || "Failed to send push notifications");
      }
    } catch (error) {
      console.error("Push notification error:", error);
      toast.error("Error sending push notifications");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-blue-900 text-sm flex items-start gap-2">
          <Bell className="h-5 w-5 mt-0.5 text-blue-600" />
          <span>
            <strong>Global Push Notifications:</strong> Send alerts to all registered users across the Website, Android App, and iOS App simultaneously. Make sure your Firebase credentials are automatically detected by the backend.
          </span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-laundrify-blue" />
            Compose Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="push-title">Notification Title</Label>
            <Input
              id="push-title"
              placeholder="e.g., Weekend Flash Sale!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-body">Message Body</Label>
            <Textarea
              id="push-body"
              placeholder="e.g., Get 50% off on all dry cleaning services this weekend only. Tap to book now!"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-route">App Route (Optional)</Label>
            <Input
              id="push-route"
              placeholder="e.g., /offers or /active-orders"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              The screen the app should open when the user taps the notification. Defaults to homeostasis (/).
            </p>
          </div>

          <Button
            className="w-full bg-laundrify-blue hover:bg-laundrify-blue/90 text-white mt-4"
            disabled={loading || !title || !body}
            onClick={handleSendPush}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-4 w-4 animate-spin" /> Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" /> Broadcast to All Users
              </span>
            )}
          </Button>

          {stats && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900">Broadcast Complete</h4>
                <p className="text-sm text-green-700">
                  {stats.isMock ? (
                    <span className="text-amber-600 font-medium">⚠️ Native push is DISABLED. Notifications only saved in-app.</span>
                  ) : (
                    <>
                      Successfully delivered to {stats.sent} users and {stats.native || 0} native devices.
                      {stats.failed !== undefined && stats.failed > 0 && ` Failed to deliver to ${stats.failed} inactive devices.`}
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Simple spinner component
const Spinner = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default AdminPushNotifications;
