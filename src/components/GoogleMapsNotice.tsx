import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';

interface GoogleMapsNoticeProps {
  className?: string;
}

const GoogleMapsNotice: React.FC<GoogleMapsNoticeProps> = ({ className = "" }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const isGoogleMapsConfigured = Boolean(apiKey && apiKey !== 'your-google-maps-api-key-here');

  if (isGoogleMapsConfigured) {
    return null; // Don't show notice if Google Maps is properly configured
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 mb-2">
            Google Maps API Key Required
          </h3>
          <p className="text-sm text-red-700 mb-3">
            Please configure your Google Maps API key to enable full address search functionality.
          </p>
          <div className="bg-red-100 rounded p-2 mb-2">
            <p className="text-xs font-mono text-red-800">
              Set: VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-red-600">
            <MapPin className="h-3 w-3" />
            <span>Limited to manual address entry only</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleMapsNotice;
