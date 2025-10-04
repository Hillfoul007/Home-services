import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  User, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Key,
  Globe
} from 'lucide-react';
import { getCurrentUser, isUserAuthenticated } from '@/utils/authUtils';
import { config } from '@/config/env';

interface AddressFunctionalityStatusProps {
  onLoginRequired?: () => void;
  className?: string;
}

const AddressFunctionalityStatus: React.FC<AddressFunctionalityStatusProps> = ({
  onLoginRequired,
  className = ''
}) => {
  const isGoogleMapsConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const isUserAuth = isUserAuthenticated();
  const currentUser = getCurrentUser();
  const isBackendAvailable = config.isBackendAvailable;
  
  const getStatusBadge = (condition: boolean, label: string) => (
    <Badge 
      variant={condition ? "default" : "destructive"}
      className={`flex items-center gap-1 ${condition ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
    >
      {condition ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  const allSystemsOperational = isGoogleMapsConfigured && isUserAuth && isBackendAvailable;

  return (
    <Card className={`border-l-4 ${allSystemsOperational ? 'border-l-green-500' : 'border-l-orange-500'} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Address Functionality Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {getStatusBadge(isGoogleMapsConfigured, "Google Maps")}
          {getStatusBadge(isUserAuth, "User Session")}
          {getStatusBadge(isBackendAvailable, "Backend API")}
        </div>

        {/* Status Messages */}
        {!isGoogleMapsConfigured && (
          <Alert className="border-orange-200 bg-orange-50">
            <Key className="h-4 w-4" />
            <AlertTitle className="text-orange-800">Google Maps Not Configured</AlertTitle>
            <AlertDescription className="text-orange-700">
              Google Maps API key is missing. Address search and map functionality will be limited.
              <br />
              <Button 
                variant="link" 
                className="p-0 h-auto text-orange-600 hover:text-orange-800"
                onClick={() => window.open('https://console.cloud.google.com/google/maps-apis/credentials', '_blank')}
              >
                Get API Key <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isUserAuth && (
          <Alert className="border-blue-200 bg-blue-50">
            <User className="h-4 w-4" />
            <AlertTitle className="text-blue-800">Authentication Recommended</AlertTitle>
            <AlertDescription className="text-blue-700 space-y-2">
              <div>Sign in to save addresses and sync across devices.</div>
              {onLoginRequired && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onLoginRequired}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <User className="h-3 w-3 mr-1" />
                  Sign In
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {!isBackendAvailable && (
          <Alert className="border-red-200 bg-red-50">
            <Globe className="h-4 w-4" />
            <AlertTitle className="text-red-800">Backend Unavailable</AlertTitle>
            <AlertDescription className="text-red-700">
              Address data will be stored locally only. Features may be limited.
            </AlertDescription>
          </Alert>
        )}

        {allSystemsOperational && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle className="text-green-800">All Systems Operational</AlertTitle>
            <AlertDescription className="text-green-700">
              Address functionality is working optimally with full map support and data sync.
            </AlertDescription>
          </Alert>
        )}

        {/* Current User Info */}
        {currentUser && (
          <div className="pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span>Current User: {currentUser.name || currentUser.phone || 'Guest'}</span>
              </div>
              {currentUser.id?.startsWith('guest_') && (
                <div className="text-amber-600 text-xs">
                  ⚠️ Guest session - addresses won't sync across devices
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AddressFunctionalityStatus;
