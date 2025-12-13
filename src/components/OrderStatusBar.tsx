import React from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";

interface OrderStatusBarProps {
  riderStatus?: string;
  bookingStatus?: string;
  className?: string;
}

const OrderStatusBar: React.FC<OrderStatusBarProps> = ({
  riderStatus = "unassigned",
  bookingStatus = "created",
  className = "",
}) => {
  // Map rider statuses to display steps
  const riderStatusSteps = [
    { value: "unassigned", label: "Order Placed", icon: "📦" },
    { value: "assigned", label: "Rider Assigned", icon: "🚴" },
    { value: "accepted", label: "Accepted", icon: "✅" },
    { value: "picked_up", label: "Picked Up", icon: "📦" },
    { value: "delivered", label: "On the way", icon: "🚗" },
    { value: "completed", label: "Delivered", icon: "🎉" },
  ];

  // Find current step index
  const currentStepIndex = riderStatusSteps.findIndex(
    (step) => step.value === riderStatus
  );

  // Determine which steps are completed, current, and upcoming
  const getStepState = (index: number) => {
    if (index < currentStepIndex) return "completed";
    if (index === currentStepIndex) return "current";
    return "upcoming";
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Horizontal Status Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        {/* Status Steps */}
        <div className="flex items-center justify-between gap-1 mb-3">
          {riderStatusSteps.map((step, index) => {
            const state = getStepState(index);
            const isCompleted = state === "completed";
            const isCurrent = state === "current";

            return (
              <React.Fragment key={step.value}>
                {/* Step Circle */}
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300
                      ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-500 text-white ring-2 ring-blue-300 animate-pulse"
                            : "bg-gray-200 text-gray-500"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isCurrent ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 mt-2 text-center truncate w-full">
                    {step.label}
                  </p>
                </div>

                {/* Connector Line */}
                {index < riderStatusSteps.length - 1 && (
                  <div
                    className={`
                      flex-grow h-1 rounded-full transition-all duration-300 mt-5
                      ${isCompleted ? "bg-green-500" : "bg-gray-300"}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Status Label */}
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">
            {riderStatusSteps[currentStepIndex]?.label || "Status Unknown"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {currentStepIndex === riderStatusSteps.length - 1
              ? "Order delivered successfully"
              : "Your order is on the way"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusBar;
