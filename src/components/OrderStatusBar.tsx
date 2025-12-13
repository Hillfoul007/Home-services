import React, { useMemo } from "react";
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
  // Define all status steps with proper mapping
  const riderStatusSteps = [
    { value: "unassigned", label: "Order Placed", icon: "📦", shortLabel: "Placed" },
    { value: "assigned", label: "Rider Assigned", icon: "🚴", shortLabel: "Assigned" },
    { value: "accepted", label: "Accepted", icon: "✅", shortLabel: "Accepted" },
    { value: "picked_up", label: "Picked Up", icon: "📦", shortLabel: "Picked" },
    { value: "on_the_way", label: "On the way", icon: "🚗", shortLabel: "Way" },
    { value: "completed", label: "Delivered", icon: "🎉", shortLabel: "Delivered" },
  ];

  // Normalize status: map common variations to standard values
  const normalizeStatus = (status: string | undefined): string => {
    if (!status) return "unassigned";
    const lowerStatus = status.toLowerCase().trim();

    // Handle various status mappings
    const statusMap: { [key: string]: string } = {
      pending: "unassigned",
      created: "unassigned",
      confirmed: "assigned",
      in_progress: "picked_up",
      "on the way": "on_the_way",
      delivered: "completed",
      done: "completed",
      finished: "completed",
    };

    return statusMap[lowerStatus] || lowerStatus;
  };

  const normalizedStatus = useMemo(() => normalizeStatus(riderStatus), [riderStatus]);

  // Find current step index
  const currentStepIndex = riderStatusSteps.findIndex(
    (step) => step.value === normalizedStatus
  );

  // Fallback to 0 if status not found
  const displayStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  // Determine which steps are completed, current, and upcoming
  const getStepState = (index: number) => {
    if (index < displayStepIndex) return "completed";
    if (index === displayStepIndex) return "current";
    return "upcoming";
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Horizontal Status Bar - Optimized for Mobile */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 sm:p-4 border border-blue-200">
        {/* Status Steps Container */}
        <div className="flex items-center justify-between gap-0.5 sm:gap-1 mb-3">
          {riderStatusSteps.map((step, index) => {
            const state = getStepState(index);
            const isCompleted = state === "completed";
            const isCurrent = state === "current";

            return (
              <React.Fragment key={step.value}>
                {/* Step Circle */}
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div
                    className={`
                      relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg transition-all duration-300 flex-shrink-0
                      ${
                        isCompleted
                          ? "bg-green-500 text-white shadow-md"
                          : isCurrent
                            ? "bg-blue-500 text-white ring-2 ring-blue-300 animate-pulse shadow-md"
                            : "bg-gray-200 text-gray-500"
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : isCurrent ? (
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Circle className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mt-1 sm:mt-2 text-center truncate w-full">
                    {step.shortLabel}
                  </p>
                </div>

                {/* Connector Line */}
                {index < riderStatusSteps.length - 1 && (
                  <div
                    className={`
                      flex-grow h-0.5 sm:h-1 rounded-full transition-all duration-300 mt-4 sm:mt-5 mx-0.5
                      ${isCompleted ? "bg-green-500" : "bg-gray-300"}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Current Status Label */}
        <div className="text-center mt-2">
          <p className="text-sm sm:text-base font-semibold text-gray-900">
            {riderStatusSteps[displayStepIndex]?.label || "Status Unknown"}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 sm:mt-1">
            {displayStepIndex === riderStatusSteps.length - 1
              ? "✓ Order delivered successfully"
              : displayStepIndex === riderStatusSteps.length - 2
                ? "Your order is on the way"
                : `Step ${displayStepIndex + 1} of ${riderStatusSteps.length}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusBar;
