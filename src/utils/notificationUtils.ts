import { Notification } from "@/contexts/NotificationContext";

// Utility functions to create different types of notifications
export const createSuccessNotification = (
  title: string,
  message: string,
): Omit<Notification, "id" | "timestamp"> => ({
  type: "success",
  title,
  message,
  read: false,
});

export const createErrorNotification = (
  title: string,
  message: string,
): Omit<Notification, "id" | "timestamp"> => ({
  type: "error",
  title,
  message,
  read: false,
});

export const createWarningNotification = (
  title: string,
  message: string,
): Omit<Notification, "id" | "timestamp"> => ({
  type: "warning",
  title,
  message,
  read: false,
});

export const createInfoNotification = (
  title: string,
  message: string,
): Omit<Notification, "id" | "timestamp"> => ({
  type: "info",
  title,
  message,
  read: false,
});

// Helper to parse alert-style messages
export const parseAlertMessage = (
  alertMessage: string,
): { title: string; message: string } => {
  // Check if message contains a title and message separated by newlines
  const lines = alertMessage.split("\n").filter((line) => line.trim());

  if (lines.length > 1) {
    return {
      title: lines[0],
      message: lines.slice(1).join(" "),
    };
  }

  // Single line message - create a generic title based on content
  if (alertMessage.toLowerCase().includes("success")) {
    return {
      title: "Success",
      message: alertMessage,
    };
  } else if (
    alertMessage.toLowerCase().includes("error") ||
    alertMessage.toLowerCase().includes("failed")
  ) {
    return {
      title: "Error",
      message: alertMessage,
    };
  } else if (alertMessage.toLowerCase().includes("invalid")) {
    return {
      title: "Invalid Input",
      message: alertMessage,
    };
  } else {
    return {
      title: "Notification",
      message: alertMessage,
    };
  }
};

// Hook to provide alert replacement functionality
export const useNotificationAlert = () => {
  // This will be used in components to replace alert() calls
  const notifySuccess = (message: string) => {
    const { title, message: msg } = parseAlertMessage(message);
    return createSuccessNotification(title, msg);
  };

  const notifyError = (message: string) => {
    const { title, message: msg } = parseAlertMessage(message);
    return createErrorNotification(title, msg);
  };

  const notifyWarning = (message: string) => {
    const { title, message: msg } = parseAlertMessage(message);
    return createWarningNotification(title, msg);
  };

  const notifyInfo = (message: string) => {
    const { title, message: msg } = parseAlertMessage(message);
    return createInfoNotification(title, msg);
  };

  return {
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  };
};
