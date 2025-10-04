import React from "react";
import { AlertCircle } from "lucide-react";

interface ValidationError {
  field: string;
  message: string;
}

interface FormValidationProps {
  errors: ValidationError[];
  className?: string;
}

export const FormValidation: React.FC<FormValidationProps> = ({
  errors,
  className = "",
}) => {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800 mb-1">
            Please fix the following:
          </h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-red-500 text-xs">•</span>
                <span>{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Helper function to validate checkout form
export const validateCheckoutForm = (
  currentUser: any,
  addressData: any,
  phoneNumber: string,
  selectedDate: Date | null,
  selectedTime: string,
  deliveryDate?: Date | null,
  deliveryTime?: string,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!currentUser) {
    errors.push({
      field: "auth",
      message: "Please sign in to complete your booking",
    });
  }

  if (!addressData || !addressData.fullAddress) {
    errors.push({
      field: "address",
      message: "Pickup address is required",
    });
  }

  // Flat/House number is optional - removed validation
  // if (!addressData?.flatNo?.trim()) {
  //   errors.push({
  //     field: "flatNo",
  //     message: "Flat/House number is required",
  //   });
  // }

  if (!phoneNumber?.trim()) {
    errors.push({
      field: "phone",
      message: "Phone number is required",
    });
  } else if (!/^[6-9]\d{9}$/.test(phoneNumber.trim())) {
    errors.push({
      field: "phone",
      message: "Please enter a valid 10-digit mobile number",
    });
  }

  if (!selectedDate) {
    errors.push({
      field: "date",
      message: "Pickup date is required",
    });
  }

  if (!selectedTime) {
    errors.push({
      field: "time",
      message: "Pickup time is required",
    });
  }

  if (!deliveryDate) {
    errors.push({
      field: "deliveryDate",
      message: "Delivery date is required",
    });
  }

  if (!deliveryTime) {
    errors.push({
      field: "deliveryTime",
      message: "Delivery time is required",
    });
  }

  // Validate address type is selected
  if (
    addressData &&
    (!addressData.type ||
      !["home", "office", "other"].includes(addressData.type))
  ) {
    errors.push({
      field: "address.type",
      message: "Please select address type (Home/Office/Other)",
    });
  }

  return errors;
};

// Async helper function to validate checkout form with location availability
export const validateCheckoutFormWithLocation = async (
  currentUser: any,
  addressData: any,
  phoneNumber: string,
  selectedDate: Date | null,
  selectedTime: string,
  deliveryDate?: Date | null,
  deliveryTime?: string,
): Promise<{ errors: ValidationError[]; locationUnavailable: boolean }> => {
  // Get basic validation errors first
  const errors = validateCheckoutForm(
    currentUser,
    addressData,
    phoneNumber,
    selectedDate,
    selectedTime,
    deliveryDate,
    deliveryTime,
  );

  let locationUnavailable = false;

  // If address is provided, check location availability
  if (addressData && addressData.fullAddress) {
    try {
      // Import the service dynamically to avoid circular dependencies
      const { LocationDetectionService } = await import(
        "@/services/locationDetectionService"
      );
      const locationService = LocationDetectionService.getInstance();

      // Extract city from address for availability check
      const city = addressData.city || addressData.village || "";
      const pincode = addressData.pincode || "";

      console.log("🏠 Checking location availability for booking:", {
        city,
        pincode,
        address: addressData.fullAddress,
      });

      const availability = await locationService.checkLocationAvailability(
        city,
        pincode,
        addressData.fullAddress,
      );

      console.log("🏠 Location availability result:", availability);

      if (!availability.is_available) {
        locationUnavailable = true;
        errors.push({
          field: "location",
          message:
            "Service not available in your area.",
        });
      }
    } catch (error) {
      console.error(
        "❌ Error checking location availability during booking:",
        error,
      );
      // Don't block booking if location check fails - assume available
      console.warn(
        "⚠️ Location availability check failed, allowing booking to proceed",
      );
    }
  }

  return { errors, locationUnavailable };
};

export default FormValidation;
