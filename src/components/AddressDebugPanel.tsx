import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddressService } from '@/services/addressService';
import { SessionManager } from '@/utils/sessionManager';
import { getCurrentUser } from '@/utils/authUtils';
import { RefreshCw, MapPin, User, Database } from 'lucide-react';

const AddressDebugPanel: React.FC = () => {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const loadDebugInfo = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get session info
      const sessionManager = SessionManager.getInstance();
      const session = sessionManager.getCurrentSession();
      const currentUser = getCurrentUser();
      
      setSessionInfo({
        session,
        currentUser,
        localStorage: {
          current_user: localStorage.getItem('current_user'),
          cleancare_user: localStorage.getItem('cleancare_user'),
          cleancare_auth_token: localStorage.getItem('cleancare_auth_token'),
        }
      });

      // Try to load addresses
      const addressService = AddressService.getInstance();
      const result = await addressService.getUserAddresses();
      
      if (result.success) {
        setAddresses(result.data || []);
      } else {
        setError(result.error || 'Failed to load addresses');
        setAddresses([]);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const createTestAddress = async () => {
    const sessionManager = SessionManager.getInstance();
    const session = sessionManager.ensureValidSession();
    
    const testAddress = {
      flatNo: 'Test 123',
      street: 'Test Street',
      landmark: 'Test Landmark',
      village: 'Test Area',
      city: 'Test City', 
      pincode: '110001',
      fullAddress: 'Test 123, Test Street, Test Landmark, Test Area, Test City, 110001',
      type: 'home' as const,
      phone: session.user?.phone || '9999999999',
      name: session.user?.name || 'Test User',
      coordinates: { lat: 28.6139, lng: 77.209 }
    };

    const addressService = AddressService.getInstance();
    const result = await addressService.saveAddress(testAddress);
    
    if (result.success) {
      console.log('✅ Test address created');
      loadDebugInfo();
    } else {
      setError(`Failed to create test address: ${result.error}`);
    }
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Address System Debug Panel
          <Button
            size="sm"
            variant="outline"
            onClick={loadDebugInfo}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Session Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs space-y-1">
                <div>
                  <Badge variant={sessionInfo?.session?.isAuthenticated ? "default" : "destructive"}>
                    {sessionInfo?.session?.isAuthenticated ? "Authenticated" : "Not Authenticated"}
                  </Badge>
                  {sessionInfo?.session?.isGuest && (
                    <Badge variant="secondary" className="ml-2">Guest</Badge>
                  )}
                </div>
                <div>User ID: {sessionInfo?.session?.userId || 'None'}</div>
                <div>User Name: {sessionInfo?.currentUser?.name || 'None'}</div>
                <div>User Phone: {sessionInfo?.currentUser?.phone || 'None'}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Storage Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs space-y-1">
                <div>
                  <Badge variant={sessionInfo?.localStorage?.current_user ? "default" : "secondary"}>
                    current_user: {sessionInfo?.localStorage?.current_user ? "Present" : "Empty"}
                  </Badge>
                </div>
                <div>
                  <Badge variant={sessionInfo?.localStorage?.cleancare_user ? "default" : "secondary"}>
                    cleancare_user: {sessionInfo?.localStorage?.cleancare_user ? "Present" : "Empty"}
                  </Badge>
                </div>
                <div>
                  <Badge variant={sessionInfo?.localStorage?.cleancare_auth_token ? "default" : "secondary"}>
                    auth_token: {sessionInfo?.localStorage?.cleancare_auth_token ? "Present" : "Empty"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Addresses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 justify-between">
              <span>
                <MapPin className="h-4 w-4 inline mr-2" />
                Saved Addresses ({addresses.length})
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={createTestAddress}
                disabled={loading}
              >
                Add Test Address
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-red-600 text-sm mb-2 p-2 bg-red-50 rounded">
                Error: {error}
              </div>
            )}
            
            {addresses.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                No addresses found. Try creating a test address or check your authentication.
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr, index) => (
                  <div key={addr.id || index} className="border rounded p-2 text-xs">
                    <div className="font-medium">{addr.label || addr.type}</div>
                    <div className="text-gray-600">{addr.fullAddress}</div>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        ID: {addr.id || addr._id || 'No ID'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Type: {addr.type}
                      </Badge>
                      {addr.createdAt && (
                        <Badge variant="outline" className="text-xs">
                          Created: {new Date(addr.createdAt).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default AddressDebugPanel;
