import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Phone,
  Mail,
  Car,
  MapPin,
  CreditCard,
  Upload,
  CheckCircle,
  AlertCircle,
  Truck,
} from "lucide-react";
import { VehicleType, CreateRiderRequest, Coordinates } from "@/types/riders";
import RidersService from "@/services/ridersService";
import LocationManager from "@/components/LocationManager";
import RiderSetupChecker from "@/components/RiderSetupChecker";

interface RiderRegistrationFormProps {
  onSuccess?: (rider: any) => void;
  onCancel?: () => void;
}

const vehicleOptions: {
  value: VehicleType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "bike", label: "Bike", icon: <Truck className="w-4 h-4" /> },
  { value: "scooter", label: "Scooter", icon: <Truck className="w-4 h-4" /> },
  {
    value: "motorcycle",
    label: "Motorcycle",
    icon: <Truck className="w-4 h-4" />,
  },
  { value: "car", label: "Car", icon: <Car className="w-4 h-4" /> },
  { value: "bicycle", label: "Bicycle", icon: <Truck className="w-4 h-4" /> },
  { value: "on_foot", label: "On Foot", icon: <User className="w-4 h-4" /> },
];

const RiderRegistrationForm: React.FC<RiderRegistrationFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSetupChecker, setShowSetupChecker] = useState(true);

  const [formData, setFormData] = useState<
    CreateRiderRequest & {
      date_of_birth?: string;
      vehicle_model?: string;
      vehicle_registration?: string;
      license_expiry?: string;
    }
  >({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    vehicle_type: "bike",
    vehicle_model: "",
    vehicle_registration: "",
    license_number: "",
    license_expiry: "",
    base_location: "",
    base_coordinates: undefined,
    service_radius_km: 10,
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(""); // Clear errors when user types
  };

  const handleLocationChange = (
    location: string,
    coordinates?: Coordinates,
  ) => {
    setFormData((prev) => ({
      ...prev,
      base_location: location,
      base_coordinates: coordinates,
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.full_name.trim()) {
          setError("Full name is required");
          return false;
        }
        if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
          setError("Valid email is required");
          return false;
        }
        if (!formData.phone.trim()) {
          setError("Phone number is required");
          return false;
        }
        break;
      case 2:
        if (!formData.vehicle_type) {
          setError("Vehicle type is required");
          return false;
        }
        if (!formData.license_number.trim()) {
          setError("License number is required");
          return false;
        }
        break;
      case 3:
        if (!formData.base_location) {
          setError("Base location is required");
          return false;
        }
        if (!formData.service_radius_km || formData.service_radius_km <= 0) {
          setError("Service radius must be greater than 0");
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: submitError } =
        await RidersService.createRider(formData);

      if (submitError) {
        // Check if it's a table missing error
        if (
          submitError.message?.includes('relation "riders" does not exist') ||
          submitError.message?.includes("does not exist")
        ) {
          setError(
            "Database setup required. Please follow the setup guide in RIDERS_TABLE_SETUP.md to create the riders table first.",
          );
          return;
        }

        // Check if it's an authentication error
        if (
          submitError.message?.includes("not authenticated") ||
          submitError.message?.includes("JWT")
        ) {
          setError("Please log in first before registering as a rider.");
          return;
        }

        throw new Error(
          submitError.message || "Failed to create rider profile",
        );
      }

      setSuccess(
        "Rider profile created successfully! Your application is under review.",
      );

      if (onSuccess && data) {
        setTimeout(() => onSuccess(data), 2000);
      }
    } catch (err) {
      console.error("Rider registration error:", err);

      // Provide helpful error messages
      let errorMessage = "An error occurred during registration.";

      if (err instanceof Error) {
        if (err.message.includes("fetch")) {
          errorMessage =
            "Connection error. Please check your internet connection and try again.";
        } else if (err.message.includes("CORS")) {
          errorMessage =
            "Configuration error. Please check your Supabase setup.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <User className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">
          Personal Information
        </h2>
        <p className="text-gray-600">Tell us about yourself</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="full_name" className="text-gray-700 font-medium">
            Full Name *
          </Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => handleInputChange("full_name", e.target.value)}
            placeholder="Enter your full name"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="date_of_birth" className="text-gray-700 font-medium">
            Date of Birth
          </Label>
          <Input
            id="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-gray-700 font-medium">
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="your.email@example.com"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="phone" className="text-gray-700 font-medium">
            Phone Number *
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="mt-2"
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Emergency Contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label
              htmlFor="emergency_name"
              className="text-gray-700 font-medium"
            >
              Contact Name
            </Label>
            <Input
              id="emergency_name"
              value={formData.emergency_contact_name}
              onChange={(e) =>
                handleInputChange("emergency_contact_name", e.target.value)
              }
              placeholder="Emergency contact name"
              className="mt-2"
            />
          </div>

          <div>
            <Label
              htmlFor="emergency_phone"
              className="text-gray-700 font-medium"
            >
              Contact Phone
            </Label>
            <Input
              id="emergency_phone"
              type="tel"
              value={formData.emergency_contact_phone}
              onChange={(e) =>
                handleInputChange("emergency_contact_phone", e.target.value)
              }
              placeholder="Emergency contact phone"
              className="mt-2"
            />
          </div>

          <div>
            <Label
              htmlFor="emergency_relationship"
              className="text-gray-700 font-medium"
            >
              Relationship
            </Label>
            <Input
              id="emergency_relationship"
              value={formData.emergency_contact_relationship}
              onChange={(e) =>
                handleInputChange(
                  "emergency_contact_relationship",
                  e.target.value,
                )
              }
              placeholder="e.g., Spouse, Parent"
              className="mt-2"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <Car className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">
          Vehicle Information
        </h2>
        <p className="text-gray-600">Tell us about your vehicle</p>
      </div>

      <div>
        <Label className="text-gray-700 font-medium">Vehicle Type *</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {vehicleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleInputChange("vehicle_type", option.value)}
              className={`p-4 border-2 rounded-xl text-sm transition-all flex flex-col items-center space-y-2 ${
                formData.vehicle_type === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="vehicle_model" className="text-gray-700 font-medium">
            Vehicle Model
          </Label>
          <Input
            id="vehicle_model"
            value={formData.vehicle_model}
            onChange={(e) => handleInputChange("vehicle_model", e.target.value)}
            placeholder="e.g., Honda Civic, Yamaha FZ"
            className="mt-2"
          />
        </div>

        <div>
          <Label
            htmlFor="vehicle_registration"
            className="text-gray-700 font-medium"
          >
            Vehicle Registration
          </Label>
          <Input
            id="vehicle_registration"
            value={formData.vehicle_registration}
            onChange={(e) =>
              handleInputChange("vehicle_registration", e.target.value)
            }
            placeholder="Vehicle registration number"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="license_number" className="text-gray-700 font-medium">
            License Number *
          </Label>
          <Input
            id="license_number"
            value={formData.license_number}
            onChange={(e) =>
              handleInputChange("license_number", e.target.value)
            }
            placeholder="Driving license number"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="license_expiry" className="text-gray-700 font-medium">
            License Expiry Date
          </Label>
          <Input
            id="license_expiry"
            type="date"
            value={formData.license_expiry}
            onChange={(e) =>
              handleInputChange("license_expiry", e.target.value)
            }
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <MapPin className="w-16 h-16 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">
          Location & Service Area
        </h2>
        <p className="text-gray-600">
          Set your base location and service radius
        </p>
      </div>

      <div>
        <Label className="text-gray-700 font-medium mb-3 block">
          Base Location *
        </Label>
        <LocationManager
          onLocationChange={handleLocationChange}
          showInTopBar={false}
          className="border rounded-xl p-4"
          enableSaveToDatabase={false}
          showFavorites={false}
          showHistory={false}
        />
        {formData.base_location && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Selected:</strong> {formData.base_location}
            </p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="service_radius" className="text-gray-700 font-medium">
          Service Radius (km) *
        </Label>
        <Input
          id="service_radius"
          type="number"
          min="1"
          max="50"
          value={formData.service_radius_km}
          onChange={(e) =>
            handleInputChange("service_radius_km", Number(e.target.value))
          }
          placeholder="10"
          className="mt-2"
        />
        <p className="text-sm text-gray-600 mt-1">
          Maximum distance you're willing to travel for deliveries
        </p>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>
        <p className="text-gray-600">
          Please review your information before submitting
        </p>
      </div>

      <div className="space-y-4">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{formData.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{formData.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span className="font-medium">{formData.phone}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Vehicle Type:</span>
              <Badge variant="secondary">
                {
                  vehicleOptions.find((v) => v.value === formData.vehicle_type)
                    ?.label
                }
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">License Number:</span>
              <span className="font-medium">{formData.license_number}</span>
            </div>
            {formData.vehicle_model && (
              <div className="flex justify-between">
                <span className="text-gray-600">Model:</span>
                <span className="font-medium">{formData.vehicle_model}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Service Area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Base Location:</span>
              <span className="font-medium text-right flex-1 ml-4">
                {formData.base_location}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Service Radius:</span>
              <span className="font-medium">
                {formData.service_radius_km} km
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Next Steps:</strong> After submission, your application will
          be reviewed within 24-48 hours. You'll be notified via email once
          approved to start accepting delivery requests.
        </AlertDescription>
      </Alert>
    </div>
  );

  // Show setup checker first if database isn't ready
  if (showSetupChecker) {
    return (
      <RiderSetupChecker onSetupComplete={() => setShowSetupChecker(false)} />
    );
  }

  if (success) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Registration Successful!
          </h2>
          <p className="text-gray-600 mb-4">{success}</p>
          <Button
            onClick={onCancel}
            className="bg-green-600 hover:bg-green-700"
          >
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step}
              </div>
              {step < 4 && (
                <div
                  className={`w-24 h-1 mx-2 ${
                    step < currentStep ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Step {currentStep} of 4:{" "}
            {currentStep === 1
              ? "Personal Information"
              : currentStep === 2
                ? "Vehicle Information"
                : currentStep === 3
                  ? "Location & Service Area"
                  : "Review & Submit"}
          </p>
        </div>
      </div>

      <Card className="border border-blue-200 shadow-xl">
        <CardContent className="p-8">
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          <div className="flex justify-between pt-8 border-t">
            <Button
              type="button"
              onClick={currentStep === 1 ? onCancel : prevStep}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>

            {currentStep < 4 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
              >
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RiderRegistrationForm;
