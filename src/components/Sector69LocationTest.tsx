import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LocationDetectionService } from '@/services/locationDetectionService';
import { MapPin, CheckCircle, XCircle } from 'lucide-react';

const Sector69LocationTest: React.FC = () => {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customLat, setCustomLat] = useState('28.3960');
  const [customLng, setCustomLng] = useState('77.0370');

  const testSector69Detection = async (lat?: number, lng?: number) => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const locationService = LocationDetectionService.getInstance();
      
      // Test coordinates for Sector 69 (center of the bounding box)
      const testCoords = {
        lat: lat || 28.3960,
        lng: lng || 77.0370
      };

      const result = await locationService.checkLocationAvailability(
        'Gurugram Sector 69',
        '122018',
        'Sector 69, Gurugram',
        testCoords
      );

      setTestResult({
        coordinates: testCoords,
        result,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Sector 69 Location Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Latitude"
            value={customLat}
            onChange={(e) => setCustomLat(e.target.value)}
            type="number"
            step="0.0001"
          />
          <Input
            placeholder="Longitude"
            value={customLng}
            onChange={(e) => setCustomLng(e.target.value)}
            type="number"
            step="0.0001"
          />
        </div>

        <div className="space-y-2">
          <Button 
            onClick={() => testSector69Detection()}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Default Sector 69 Coords'}
          </Button>
          
          <Button 
            onClick={() => testSector69Detection(parseFloat(customLat), parseFloat(customLng))}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Custom Coordinates'}
          </Button>
        </div>

        {testResult && (
          <div className="mt-4 p-3 border rounded-lg">
            <div className="text-sm text-gray-600 mb-2">
              Test Results ({testResult.timestamp})
            </div>
            
            {testResult.coordinates && (
              <div className="text-xs text-gray-500 mb-2">
                Coordinates: {testResult.coordinates.lat}, {testResult.coordinates.lng}
              </div>
            )}

            {testResult.result ? (
              <div className={`flex items-center gap-2 ${
                testResult.result.is_available ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.result.is_available ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {testResult.result.is_available ? 'Available' : 'Not Available'}
                </span>
              </div>
            ) : null}

            {testResult.result?.message && (
              <div className="text-sm text-gray-700 mt-1">
                {testResult.result.message}
              </div>
            )}

            {testResult.error && (
              <div className="text-sm text-red-600">
                Error: {testResult.error}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          <strong>Sector 69 Bounding Box:</strong><br />
          Lat: 28.3940 - 28.3980<br />
          Lng: 77.0350 - 77.0390
        </div>
      </CardContent>
    </Card>
  );
};

export default Sector69LocationTest;
