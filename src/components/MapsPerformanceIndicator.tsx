import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '../utils/mapsPerformanceMonitor';
import { MAPS_PERFORMANCE_CONFIG } from '../config/mapsConfig';

interface MapsPerformanceIndicatorProps {
  className?: string;
}

const MapsPerformanceIndicator: React.FC<MapsPerformanceIndicatorProps> = ({ 
  className = "" 
}) => {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      const recs = performanceMonitor.getRecommendations();
      setRecommendations(recs);
      
      // Show/hide based on performance issues
      setIsVisible(recs.length > 0);
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Only show in development and if there are recommendations
  if (process.env.NODE_ENV !== 'development' || !isVisible) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 max-w-sm bg-yellow-100 border border-yellow-400 rounded-lg p-3 shadow-lg z-50 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-yellow-600">⚡</span>
        <h4 className="text-sm font-semibold text-yellow-800">
          Maps Performance Tips
        </h4>
        <button
          onClick={() => setIsVisible(false)}
          className="ml-auto text-yellow-600 hover:text-yellow-800"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1">
        {recommendations.slice(0, 3).map((rec, index) => (
          <p key={index} className="text-xs text-yellow-700">
            • {rec}
          </p>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t border-yellow-300">
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => {
              performanceMonitor.logStats();
            }}
            className="text-yellow-600 hover:text-yellow-800 underline"
          >
            View Stats
          </button>
          <button
            onClick={() => {
              performanceMonitor.reset();
              setRecommendations([]);
              setIsVisible(false);
            }}
            className="text-yellow-600 hover:text-yellow-800 underline"
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Performance config indicator */}
      <div className="mt-2 pt-2 border-t border-yellow-300">
        <p className="text-xs text-yellow-600">
          Config: 
          {MAPS_PERFORMANCE_CONFIG.USE_SIMPLIFIED_GEOCODING ? " Simplified" : ""} 
          {MAPS_PERFORMANCE_CONFIG.USE_LIGHTWEIGHT_MAP_STYLES ? " Lightweight" : ""}
          {MAPS_PERFORMANCE_CONFIG.DISABLE_ADVANCED_MARKERS ? " No Advanced Markers" : ""}
        </p>
      </div>
    </div>
  );
};

export default MapsPerformanceIndicator;
