import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Zap,
  Brain,
  Target,
} from "lucide-react";
import SmartAddressInput from "./SmartAddressInput";
import SimplifiedAddressForm from "./SimplifiedAddressForm";
import { ParsedAddress } from "@/utils/autocompleteSuggestionService";

export const AddressAutofillDemo: React.FC = () => {
  const [smartAddress, setSmartAddress] = useState<ParsedAddress>({});
  const [manualAddress, setManualAddress] = useState<any>({});
  const [smartValidation, setSmartValidation] = useState({
    isValid: false,
    errors: [],
  });
  const [demoStep, setDemoStep] = useState(0);

  const demoAddresses = [
    "Connaught Place, New Delhi",
    "Marine Drive, Mumbai",
    "Koramangala, Bangalore",
    "Times Square, New York",
    "Eiffel Tower, Paris",
  ];

  const features = [
    {
      icon: <Brain className="h-5 w-5" />,
      title: "Smart Parsing",
      description:
        "Automatically extracts house numbers, streets, areas, and postal codes",
      color: "bg-blue-500",
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: "Accurate Detection",
      description:
        "Uses Google Places API with session tokens for precise results",
      color: "bg-green-500",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Instant Autofill",
      description:
        "Fills multiple fields simultaneously while preserving user input",
      color: "bg-yellow-500",
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Real-time Validation",
      description: "Validates address completeness and provides suggestions",
      color: "bg-purple-500",
    },
  ];

  const handleSmartAddressChange = (address: ParsedAddress) => {
    setSmartAddress(address);
  };

  const handleSmartValidationChange = (isValid: boolean, errors: string[]) => {
    setSmartValidation({ isValid, errors });
  };

  const runDemo = (address: string) => {
    // This would trigger a search in the SmartAddressInput
    // For demo purposes, we'll just show the address
    setDemoStep((prev) => prev + 1);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Sparkles className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Smart Address Autofill Demo
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Experience the power of AI-enhanced address detection and autofill.
          Just type any address and watch all fields get filled automatically!
        </p>
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Key Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 border rounded-lg"
              >
                <div className={`p-2 rounded-full ${feature.color} text-white`}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-500" />
            Quick Demo - Try These Addresses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {demoAddresses.map((address, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => runDemo(address)}
                className="text-left h-auto py-3"
              >
                <div>
                  <div className="font-medium text-sm">
                    {address.split(",")[0]}
                  </div>
                  <div className="text-xs text-gray-500">
                    {address.split(",").slice(1).join(",")}
                  </div>
                </div>
              </Button>
            ))}
          </div>
          {demoStep > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                🎉 Demo step {demoStep} completed! Try the smart input below to
                see the magic happen.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Demo Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Address Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-600" />
                Smart Address Input
              </div>
              <Badge
                variant={smartValidation.isValid ? "default" : "secondary"}
                className={smartValidation.isValid ? "bg-green-600" : ""}
              >
                {smartValidation.isValid ? "Complete" : "Incomplete"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SmartAddressInput
              onAddressChange={handleSmartAddressChange}
              onValidationChange={handleSmartValidationChange}
              placeholder="🚀 Type any address (e.g., 'Connaught Place Delhi', '123 Main St NYC')"
              showValidation={true}
              showCurrentLocation={true}
            />

            {/* Smart Address Preview */}
            {Object.keys(smartAddress).length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-sm">Parsed Address Data:</h4>
                <div className="text-xs space-y-1 p-3 bg-gray-50 rounded border">
                  {Object.entries(smartAddress).map(
                    ([key, value]) =>
                      value && (
                        <div key={key} className="flex">
                          <span className="font-medium w-20">{key}:</span>
                          <span className="text-gray-700">
                            {value.toString()}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Address Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Traditional Manual Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimplifiedAddressForm
              onAddressChange={setManualAddress}
              className="border-0 shadow-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Comparison Results */}
      {(Object.keys(smartAddress).length > 0 ||
        Object.keys(manualAddress).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Results Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Smart Results */}
              <div>
                <h3 className="font-semibold text-green-600 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Smart Input Results
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        smartValidation.isValid ? "default" : "destructive"
                      }
                    >
                      {smartValidation.isValid ? "Complete" : "Incomplete"}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {
                        Object.keys(smartAddress).filter(
                          (key) => smartAddress[key as keyof ParsedAddress],
                        ).length
                      }{" "}
                      fields filled
                    </span>
                  </div>
                  {smartValidation.errors.length > 0 && (
                    <div className="text-sm text-orange-600 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>Missing: {smartValidation.errors.join(", ")}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Results */}
              <div>
                <h3 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Manual Input Results
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Manual Entry</Badge>
                    <span className="text-sm text-gray-600">
                      {
                        Object.keys(manualAddress).filter(
                          (key) => manualAddress[key],
                        ).length
                      }{" "}
                      fields filled
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Benefits */}
            <div className="space-y-3">
              <h3 className="font-semibold">Smart Address Benefits:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Faster Entry:</strong> Type once, fill multiple
                    fields
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Better Accuracy:</strong> Uses official address
                    databases
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>User Friendly:</strong> Works with natural language
                    input
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Technical Implementation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Smart Features:</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Google Places AutocompleteSuggestion API (latest,
                  non-deprecated)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Session token management for optimal performance
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Smart address component parsing
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Preserves existing user input during autofill
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Real-time validation with helpful suggestions
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Address Detection:</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  Automatically detects house numbers (123, A-45, Plot 67)
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  Extracts street names and road details
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  Identifies areas, localities, and neighborhoods
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  Recognizes cities, states, and postal codes
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  Works globally with region-specific optimization
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressAutofillDemo;
