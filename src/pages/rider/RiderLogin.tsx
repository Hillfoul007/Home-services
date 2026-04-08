import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Lock, LogIn } from 'lucide-react';
import { toast } from 'sonner';

// Detect if running inside Capacitor native app
const isCapacitorNative = (): boolean => {
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    if (cap && cap.getPlatform && cap.getPlatform() !== 'web') return true;
    return false;
  } catch {
    return false;
  }
};

// Helper function to get the correct API URL for rider endpoints
const getRiderApiUrl = (endpoint: string): string => {
  const isDev = import.meta.env.DEV;
  const hostname = window.location.hostname;
  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isRenderCom = hostname.includes("onrender.com");
  const isLaundrifyDomain = hostname.includes("laundrify.online");
  const BACKEND_BASE = 'https://home-services-5alb.onrender.com/api/riders';

  // Capacitor native app always uses production backend
  if (isCapacitorNative()) {
    console.log('📱 Capacitor native - using production backend for rider API');
    return BACKEND_BASE + endpoint;
  }

  // Local development with dev server - use vite proxy
  if (isLocalhost && isDev) {
    console.log('🏠 Using local proxy for rider API');
    return `/api/riders${endpoint}`;
  }

  // Any hosted/production environment - use backend server
  if (isRenderCom || isLaundrifyDomain || !isLocalhost) {
    console.log('🌐 Using backend server for rider API');
    return BACKEND_BASE + endpoint;
  }

  // Fallback to production backend (not relative URL)
  return BACKEND_BASE + endpoint;
};

export default function RiderLogin() {
  const [credentials, setCredentials] = useState({
    phone: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const testBackendConnectivity = async () => {
    try {
      // Test if backend is reachable using the correct rider API URL
      const testUrl = getRiderApiUrl('/test');
      const testResponse = await fetch(testUrl, {
        method: 'GET',
      });
      console.log('🔍 Backend Health Check:', {
        status: testResponse.status,
        url: testResponse.url,
        accessible: testResponse.ok
      });

      return testResponse.ok;
    } catch (error) {
      console.log('🔍 Backend Health Check Failed:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!credentials.phone || !credentials.password) {
      toast.error('Please fill all fields');
      return;
    }

    setIsLoading(true);

    // Test backend connectivity first
    const backendAccessible = await testBackendConnectivity();

    if (!backendAccessible) {
      toast.error('Cannot connect to server. Please check your internet connection.');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = getRiderApiUrl('/login');
      console.log('🔍 Rider Login Debug:', {
        apiUrl,
        credentials: { phone: credentials.phone, password: '[REDACTED]' },
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log('🔍 Rider Login Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Login successful:', result);

        // Store authentication data
        localStorage.setItem('riderAuth', JSON.stringify(result.rider));
        localStorage.setItem('riderToken', result.token);

        // Initialize mobile push notifications for rider
        try {
          const { MobilePushService } = await import('@/services/MobilePushService');
          MobilePushService.getInstance().initialize(undefined, { riderId: result.rider._id || result.rider.id });
        } catch (e) {
          console.warn('Push notification init failed:', e);
        }

        toast.success('Login successful!');

        navigate('/rider/dashboard');
      } else {
        try {
          const error = await response.json();
          console.log('❌ Login error details:', error);

          if (response.status === 400) {
            toast.error(error.message || 'Invalid phone number or password');
          } else if (response.status === 403) {
            if (error.status === 'pending') {
              toast.error('Your account is still pending approval from admin');
            } else if (error.status === 'rejected') {
              toast.error('Your account has been rejected. Please contact admin.');
            } else {
              toast.error(error.message || 'Account not approved');
            }
          } else if (response.status === 404) {
            toast.error('Rider system is not available on this server. Please use local development.');
          } else {
            toast.error(error.message || 'Login failed - Server error');
          }
        } catch (e) {
          if (response.status === 404) {
            toast.error('Rider system is not available on this backend.');
          } else {
            toast.error('Login failed - Network error');
          }
        }
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 rider-mobile-layout">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center space-x-2 rider-label-mobile">
            <Phone className="h-4 w-4" />
            <span>Phone Number</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Enter your phone number"
            value={credentials.phone}
            onChange={handleInputChange}
            required
            className="rider-input-mobile"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="flex items-center space-x-2 rider-label-mobile">
            <Lock className="h-4 w-4" />
            <span>Password</span>
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            value={credentials.password}
            onChange={handleInputChange}
            required
            className="rider-input-mobile"
          />
        </div>

        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-blue-900 text-sm font-medium mb-2 rider-text-body-mobile">🚀 Rider System</p>
          <p className="text-blue-700 text-xs mb-2 rider-text-small-mobile">
            <strong>Environment:</strong> {window.location.hostname}
          </p>
          <p className="text-blue-700 text-xs mb-2 rider-text-small-mobile">
            <strong>API Endpoint:</strong> {getRiderApiUrl('/login')}
          </p>
          <p className="text-blue-700 text-xs mb-2 rider-text-small-mobile">
            <strong>Mode:</strong> {import.meta.env.MODE} | <strong>Dev:</strong> {import.meta.env.DEV ? 'Yes' : 'No'}
          </p>

          {getRiderApiUrl('/login').includes('backend-vaxf.onrender.com') ? (
            <div className="bg-green-50 p-2 rounded mt-2 border border-green-200">
              <p className="text-green-800 text-xs font-medium rider-text-small-mobile">✅ Production Backend</p>
              <p className="text-green-700 text-xs rider-text-small-mobile">
                Use your registered phone number and password to login.
              </p>
              <p className="text-red-700 text-xs rider-text-small-mobile">
                <strong>Note:</strong> Only approved riders can login. Check with admin if you can't access your account.
              </p>
            </div>
          ) : import.meta.env.DEV ? (
            <div className="bg-green-50 p-2 rounded mt-2 border border-green-200">
              <p className="text-green-800 text-xs font-medium rider-text-small-mobile">✅ Development Mode</p>
              <p className="text-green-700 text-xs rider-text-small-mobile">
                Full database functionality with registered rider accounts.
              </p>
            </div>
          ) : (
            <p className="text-orange-700 text-xs rider-text-small-mobile">
              ⚠️ Production mode. Use registered credentials.
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="rider-action-button-mobile rider-primary-action-mobile"
          disabled={isLoading}
        >
          {isLoading ? (
            'Logging in...'
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </>
          )}
        </Button>
      </form>
      
      <Alert className="rider-alert-mobile rider-alert-info-mobile">
        <AlertDescription className="rider-text-body-mobile">
          New to our platform? Register above to join our delivery team.
          Your account will be verified by our admin before you can start working.
        </AlertDescription>
      </Alert>
    </div>
  );
}
