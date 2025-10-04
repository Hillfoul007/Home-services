// Comprehensive error handling service for all operations

export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  action?: string;
  retryable: boolean;
  details?: any;
}

export class ErrorHandler {
  static logError(error: any, context: string, additionalData?: any) {
    console.group(`🚨 Error in ${context}`);
    console.error("Error:", error);
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);
    if (additionalData) {
      console.error("Additional Data:", additionalData);
    }
    console.groupEnd();
  }

  static handleDatabaseError(error: any, operation: string): ErrorDetails {
    this.logError(error, `Database - ${operation}`);

    // Connection errors
    if (
      error?.message?.includes("connect") ||
      error?.message?.includes("network")
    ) {
      return {
        code: "CONNECTION_ERROR",
        message: error.message,
        userMessage:
          "Unable to connect to the database. Please check your internet connection.",
        action: "Check your internet connection and try again.",
        retryable: true,
      };
    }

    // Authentication errors
    if (
      error?.message?.includes("JWT") ||
      error?.message?.includes("not authenticated") ||
      error?.message?.includes("unauthorized")
    ) {
      return {
        code: "AUTH_ERROR",
        message: error.message,
        userMessage: "You need to log in to perform this action.",
        action: "Please log in and try again.",
        retryable: false,
      };
    }

    // Permission errors
    if (
      error?.message?.includes("permission denied") ||
      error?.message?.includes("access denied")
    ) {
      return {
        code: "PERMISSION_ERROR",
        message: error.message,
        userMessage: "You don't have permission to perform this action.",
        action: "Contact support if you think this is an error.",
        retryable: false,
      };
    }

    // Table/column doesn't exist
    if (
      error?.message?.includes("relation") &&
      error?.message?.includes("does not exist")
    ) {
      const tableName = this.extractTableName(error.message);
      return {
        code: "TABLE_NOT_FOUND",
        message: error.message,
        userMessage: `Database table "${tableName}" is missing. Setup required.`,
        action: "Please run the database setup script first.",
        retryable: false,
        details: { tableName },
      };
    }

    // Constraint violations
    if (
      error?.message?.includes("duplicate key") ||
      error?.message?.includes("already exists")
    ) {
      return {
        code: "DUPLICATE_ERROR",
        message: error.message,
        userMessage: "This record already exists.",
        action: "Please use different values or update the existing record.",
        retryable: false,
      };
    }

    // Validation errors
    if (
      error?.message?.includes("violates check constraint") ||
      error?.message?.includes("invalid input")
    ) {
      return {
        code: "VALIDATION_ERROR",
        message: error.message,
        userMessage: "Invalid data provided.",
        action: "Please check your input and try again.",
        retryable: true,
      };
    }

    // Foreign key constraint
    if (error?.message?.includes("foreign key constraint")) {
      return {
        code: "FOREIGN_KEY_ERROR",
        message: error.message,
        userMessage: "Referenced record not found.",
        action: "Please make sure all related records exist.",
        retryable: false,
      };
    }

    // Generic database error
    return {
      code: "DATABASE_ERROR",
      message: error.message || "Unknown database error",
      userMessage: "A database error occurred.",
      action: "Please try again or contact support.",
      retryable: true,
    };
  }

  static handleNetworkError(error: any, operation: string): ErrorDetails {
    this.logError(error, `Network - ${operation}`);

    if (error?.message?.includes("fetch")) {
      return {
        code: "FETCH_ERROR",
        message: error.message,
        userMessage: "Failed to connect to the server.",
        action: "Please check your internet connection and try again.",
        retryable: true,
      };
    }

    if (error?.message?.includes("CORS")) {
      return {
        code: "CORS_ERROR",
        message: error.message,
        userMessage: "Configuration error occurred.",
        action: "Please contact support.",
        retryable: false,
      };
    }

    if (error?.message?.includes("timeout")) {
      return {
        code: "TIMEOUT_ERROR",
        message: error.message,
        userMessage: "The request timed out.",
        action: "Please try again with a stable internet connection.",
        retryable: true,
      };
    }

    return {
      code: "NETWORK_ERROR",
      message: error.message || "Network error",
      userMessage: "Network error occurred.",
      action: "Please check your connection and try again.",
      retryable: true,
    };
  }

  static handleFormValidationError(
    field: string,
    value: any,
    rule: string,
  ): ErrorDetails {
    const fieldName = field
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    let userMessage = "";
    let action = "";

    switch (rule) {
      case "required":
        userMessage = `${fieldName} is required.`;
        action = `Please enter a ${fieldName.toLowerCase()}.`;
        break;
      case "email":
        userMessage = "Please enter a valid email address.";
        action = "Example: user@example.com";
        break;
      case "phone":
        userMessage = "Please enter a valid phone number.";
        action = "Example: +1234567890 or +91-9876543210";
        break;
      case "min_length":
        userMessage = `${fieldName} is too short.`;
        action = "Please enter at least the minimum required characters.";
        break;
      case "max_length":
        userMessage = `${fieldName} is too long.`;
        action = "Please reduce the number of characters.";
        break;
      case "numeric":
        userMessage = `${fieldName} must be a number.`;
        action = "Please enter only numeric values.";
        break;
      case "positive":
        userMessage = `${fieldName} must be greater than zero.`;
        action = "Please enter a positive number.";
        break;
      default:
        userMessage = `Invalid ${fieldName.toLowerCase()}.`;
        action = "Please check your input and try again.";
    }

    return {
      code: "VALIDATION_ERROR",
      message: `Validation failed for field ${field}: ${rule}`,
      userMessage,
      action,
      retryable: true,
      details: { field, value, rule },
    };
  }

  static handleLocationError(error: any): ErrorDetails {
    this.logError(error, "Location Service");

    if (error?.code === 1) {
      // PERMISSION_DENIED
      return {
        code: "LOCATION_PERMISSION_DENIED",
        message: "Location access denied",
        userMessage: "Location access is required for this feature.",
        action: "Please enable location permissions in your browser settings.",
        retryable: false,
      };
    }

    if (error?.code === 2) {
      // POSITION_UNAVAILABLE
      return {
        code: "LOCATION_UNAVAILABLE",
        message: "Location unavailable",
        userMessage: "Unable to determine your location.",
        action: "Please make sure GPS is enabled and try again.",
        retryable: true,
      };
    }

    if (error?.code === 3) {
      // TIMEOUT
      return {
        code: "LOCATION_TIMEOUT",
        message: "Location request timed out",
        userMessage: "Location request took too long.",
        action: "Please try again or enter your location manually.",
        retryable: true,
      };
    }

    return {
      code: "LOCATION_ERROR",
      message: error?.message || "Location error",
      userMessage: "Unable to get your location.",
      action: "Please try again or enter your location manually.",
      retryable: true,
    };
  }

  static handleFileUploadError(error: any, filename?: string): ErrorDetails {
    this.logError(error, "File Upload", { filename });

    if (
      error?.message?.includes("File too large") ||
      error?.message?.includes("size")
    ) {
      return {
        code: "FILE_TOO_LARGE",
        message: error.message,
        userMessage: "The file is too large.",
        action: "Please choose a smaller file (max 5MB).",
        retryable: true,
      };
    }

    if (
      error?.message?.includes("File type") ||
      error?.message?.includes("format")
    ) {
      return {
        code: "INVALID_FILE_TYPE",
        message: error.message,
        userMessage: "Invalid file type.",
        action: "Please upload a valid image or PDF file.",
        retryable: true,
      };
    }

    if (error?.message?.includes("storage")) {
      return {
        code: "STORAGE_ERROR",
        message: error.message,
        userMessage: "File upload failed.",
        action: "Please try uploading again.",
        retryable: true,
      };
    }

    return {
      code: "UPLOAD_ERROR",
      message: error?.message || "Upload failed",
      userMessage: "Failed to upload file.",
      action: "Please try again with a different file.",
      retryable: true,
    };
  }

  static handleGenericError(error: any, operation: string): ErrorDetails {
    this.logError(error, operation);

    // Try to categorize the error first
    if (error?.message) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        return this.handleNetworkError(error, operation);
      }
      if (
        error.message.includes("database") ||
        error.message.includes("relation")
      ) {
        return this.handleDatabaseError(error, operation);
      }
    }

    return {
      code: "UNKNOWN_ERROR",
      message: error?.message || "Unknown error occurred",
      userMessage: "An unexpected error occurred.",
      action: "Please try again or contact support if the problem persists.",
      retryable: true,
      details: { operation, error: error?.toString() },
    };
  }

  private static extractTableName(errorMessage: string): string {
    const match = errorMessage.match(/relation "([^"]+)" does not exist/);
    return match ? match[1] : "unknown";
  }

  static getRetryStrategy(errorDetails: ErrorDetails): {
    shouldRetry: boolean;
    retryAfter: number; // milliseconds
    maxRetries: number;
  } {
    if (!errorDetails.retryable) {
      return { shouldRetry: false, retryAfter: 0, maxRetries: 0 };
    }

    switch (errorDetails.code) {
      case "CONNECTION_ERROR":
      case "TIMEOUT_ERROR":
        return { shouldRetry: true, retryAfter: 5000, maxRetries: 3 };

      case "FETCH_ERROR":
      case "NETWORK_ERROR":
        return { shouldRetry: true, retryAfter: 3000, maxRetries: 2 };

      case "LOCATION_UNAVAILABLE":
      case "LOCATION_TIMEOUT":
        return { shouldRetry: true, retryAfter: 10000, maxRetries: 2 };

      case "VALIDATION_ERROR":
        return { shouldRetry: true, retryAfter: 0, maxRetries: 1 };

      default:
        return { shouldRetry: true, retryAfter: 2000, maxRetries: 1 };
    }
  }
}

// Specific error handlers for different operations
export class RiderErrorHandler {
  static handleRegistrationError(error: any): ErrorDetails {
    if (
      error?.message?.includes("email") &&
      error?.message?.includes("duplicate")
    ) {
      return {
        code: "EMAIL_EXISTS",
        message: error.message,
        userMessage: "An account with this email already exists.",
        action: "Please use a different email or try logging in.",
        retryable: false,
      };
    }

    if (
      error?.message?.includes("phone") &&
      error?.message?.includes("duplicate")
    ) {
      return {
        code: "PHONE_EXISTS",
        message: error.message,
        userMessage: "An account with this phone number already exists.",
        action: "Please use a different phone number or try logging in.",
        retryable: false,
      };
    }

    return ErrorHandler.handleDatabaseError(error, "Rider Registration");
  }

  static handleLocationUpdateError(error: any): ErrorDetails {
    if (error?.message?.includes("coordinates")) {
      return {
        code: "INVALID_COORDINATES",
        message: error.message,
        userMessage: "Invalid location coordinates.",
        action: "Please try detecting your location again.",
        retryable: true,
      };
    }

    return ErrorHandler.handleDatabaseError(error, "Location Update");
  }

  static handleStatusToggleError(error: any): ErrorDetails {
    if (
      error?.message?.includes("rider") &&
      error?.message?.includes("not found")
    ) {
      return {
        code: "RIDER_NOT_FOUND",
        message: error.message,
        userMessage: "Rider profile not found.",
        action: "Please complete your rider registration first.",
        retryable: false,
      };
    }

    return ErrorHandler.handleDatabaseError(error, "Status Toggle");
  }
}

export class DeliveryErrorHandler {
  static handleCreateDeliveryError(error: any): ErrorDetails {
    if (
      error?.message?.includes("pickup") ||
      error?.message?.includes("delivery")
    ) {
      return {
        code: "INVALID_ADDRESS",
        message: error.message,
        userMessage: "Invalid pickup or delivery address.",
        action: "Please check the addresses and try again.",
        retryable: true,
      };
    }

    return ErrorHandler.handleDatabaseError(error, "Create Delivery");
  }

  static handleAssignmentError(error: any): ErrorDetails {
    if (
      error?.message?.includes("rider") &&
      error?.message?.includes("not available")
    ) {
      return {
        code: "RIDER_NOT_AVAILABLE",
        message: error.message,
        userMessage: "Selected rider is no longer available.",
        action: "Please choose a different rider.",
        retryable: true,
      };
    }

    return ErrorHandler.handleDatabaseError(error, "Delivery Assignment");
  }
}

// Helper function to create user-friendly error notifications
export function createErrorNotification(
  error: any,
  operation: string,
): {
  title: string;
  message: string;
  type: "error" | "warning" | "info";
  duration: number;
  action?: {
    label: string;
    onClick: () => void;
  };
} {
  const errorDetails = ErrorHandler.handleGenericError(error, operation);

  return {
    title: errorDetails.code
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    message: `${errorDetails.userMessage} ${errorDetails.action}`,
    type: errorDetails.retryable ? "warning" : "error",
    duration: errorDetails.retryable ? 5000 : 8000,
    ...(errorDetails.retryable && {
      action: {
        label: "Retry",
        onClick: () => window.location.reload(),
      },
    }),
  };
}

export default ErrorHandler;
