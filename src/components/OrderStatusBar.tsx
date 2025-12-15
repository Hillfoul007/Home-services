import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

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
  // Map rider statuses to display steps (5 main steps to fit better on mobile)
  const riderStatusSteps = [
    { value: "unassigned", label: "Order Placed" },
    { value: "assigned", label: "Pickup Assigned" },
    { value: "accepted", label: "Pick Up Complete" },
    { value: "picked_up", label: "Delivery Assigned" },
    { value: "delivered", label: "Delivery Complete" },
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
      {/* Horizontal Status Bar - Responsive */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 sm:p-4 border border-blue-200 overflow-hidden">
        {/* Status Steps - Responsive Grid */}
        <div className="flex items-stretch justify-between gap-0.5 sm:gap-1 mb-4 min-w-0">
          {riderStatusSteps.map((step, index) => {
            const state = getStepState(index);
            const isCompleted = state === "completed";
            const isCurrent = state === "current";

            return (
              <React.Fragment key={step.value}>
                {/* Step Circle */}
                <div className="flex flex-col items-center justify-start flex-1 min-w-0">
                  <div
                    className={`
                      relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                      ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-500 text-white ring-2 ring-blue-300"
                            : "bg-gray-300 text-gray-600"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : isCurrent ? (
                      <Circle className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    ) : (
                      <Circle className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mt-1.5 sm:mt-2 text-center leading-tight">
                    {step.label}
                  </p>
                </div>

                {/* Connector Line */}
                {index < riderStatusSteps.length - 1 && (
                  <div
                    className={`
                      flex-grow h-1 transition-all duration-300 mt-4 sm:mt-5 mx-0.5 sm:mx-1 rounded-full
                      ${isCompleted ? "bg-green-500" : "bg-gray-300"}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Status Label */}
        <div className="text-center px-2">
          <p className="text-sm sm:text-base font-semibold text-gray-900">
            {riderStatusSteps[currentStepIndex]?.label || "Status Unknown"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {currentStepIndex === 0
              ? "Your order is being processed"
              : currentStepIndex === 1
                ? "Rider is being assigned"
                : currentStepIndex === 2
                  ? "Rider is picking up your order"
                  : currentStepIndex === 3
                    ? "Rider is on the way"
                    : "Order delivered successfully"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusBar;
