import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  Navigation,
  Activity,
  RefreshCw,
  Phone,
  Package,
  Clock,
  User,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { toast } from 'sonner';

// Helper function to get the correct API URL for admin rider endpoints
const getAdminApiUrl = (endpoint: string): string => {
  const isDev = import.meta.env.DEV;
  const hostname = window.location.hostname;
  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isRenderCom = hostname.includes("onrender.com");
  const isLaundrifyDomain = hostname.includes("laundrify.online");

  if (isLocalhost && isDev) {
    return `/api/admin${endpoint}`;
  } else if (isRenderCom || isLaundrifyDomain || !isLocalhost) {
    return `https://backend-vaxf.onrender.com/api/admin${endpoint}`;
  }

  return `/api/admin${endpoint}`;
};

interface RiderLocation {
  _id: string;
  name: string;
  phone: string;
  location: {
    lat: number;
    lng: number;
  };
  lastLocationUpdate: string;
  isActive: boolean;
  assignedOrders: any[];
  status: string;
}

interface AdminLiveMapProps {
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export default function AdminLiveMap({ fullScreen = false, onToggleFullScreen }: AdminLiveMapProps) {
  const [activeRiders, setActiveRiders] = useState<RiderLocation[]>([]);
  const [selectedRider, setSelectedRider] = useState<RiderLocation | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchActiveRiders();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchActiveRiders();
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval]);

  const fetchActiveRiders = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(getAdminApiUrl('/riders/active'), {
        headers: {
          'admin-token': 'admin-access-granted'
        }
      });

      if (response.ok) {
        const riders = await response.json();
        setActiveRiders(riders);
        setLastRefresh(new Date());
        console.log(`📍 Updated ${riders.length} active rider locations`);
      } else {
        console.error('Failed to fetch active riders:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch active riders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchActiveRiders();
    toast.info('Refreshing rider locations...');
  };

  const handleToggleAutoRefresh = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) {
      toast.success(`Auto-refresh enabled (${refreshInterval}s)`);
    } else {
      toast.info('Auto-refresh disabled');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const openInGoogleMaps = (rider: RiderLocation) => {
    if (rider.location) {
      const url = `https://www.google.com/maps/@${rider.location.lat},${rider.location.lng},15z`;
      window.open(url, '_blank');
    }
  };

  const calculateTimeSinceUpdate = (timestamp: string) => {
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diff = now.getTime() - lastUpdate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else {
      return `${minutes}m ago`;
    }
  };

  const getLocationFreshness = (timestamp: string) => {
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diff = now.getTime() - lastUpdate.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 5) return 'fresh';
    if (minutes < 15) return 'recent';
    if (minutes < 60) return 'stale';
    return 'old';
  };

  const getFreshnessColor = (freshness: string) => {
    switch (freshness) {
      case 'fresh': return 'text-green-600 bg-green-50 border-green-200';
      case 'recent': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'stale': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'old': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`space-y-4 ${fullScreen ? 'fixed inset-0 z-50 bg-white p-6 overflow-auto' : ''}`}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Live Rider Tracking</span>
                {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
              </CardTitle>
              <CardDescription>
                Real-time location tracking of active riders ({activeRiders.length} online)
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {onToggleFullScreen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleFullScreen}
                >
                  {fullScreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-refresh"
                    checked={autoRefresh}
                    onCheckedChange={handleToggleAutoRefresh}
                  />
                  <Label htmlFor="auto-refresh">Auto-refresh</Label>
                </div>
                <div className="text-sm text-gray-600">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-gray-600">Refresh every:</Label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1min</option>
                  <option value={120}>2min</option>
                  <option value={300}>5min</option>
                </select>
              </div>
            </div>

            {/* Map Placeholder and Rider List */}
            <div className={`grid ${fullScreen ? 'grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
              {/* Map Area */}
              <div className={`${fullScreen ? 'col-span-2' : 'col-span-1'}`}>
                <div 
                  ref={mapRef}
                  className="w-full h-96 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
                >
                  <div className="text-center text-gray-500 space-y-2">
                    <MapPin className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="font-medium">Interactive Map</p>
                    <p className="text-sm">
                      Map integration can be added here to show live rider locations
                    </p>
                    <p className="text-xs">
                      Click "View on Map" buttons to see individual rider locations
                    </p>
                  </div>
                </div>
              </div>

              {/* Rider List */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Active Riders</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activeRiders.map((rider) => {
                    const freshness = getLocationFreshness(rider.lastLocationUpdate);
                    const freshnessColor = getFreshnessColor(freshness);
                    
                    return (
                      <Card 
                        key={rider._id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedRider?._id === rider._id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => setSelectedRider(rider)}
                      >
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{rider.name}</h4>
                                <div className="flex items-center space-x-1 text-sm text-gray-600">
                                  <Phone className="h-3 w-3" />
                                  <span>{rider.phone}</span>
                                </div>
                              </div>
                              <Badge variant="default" className="bg-green-500">
                                <Activity className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            </div>

                            {rider.location && (
                              <div className="space-y-2">
                                <div className="text-sm">
                                  <div className="flex items-center space-x-1 text-gray-600">
                                    <MapPin className="h-3 w-3" />
                                    <span>
                                      {rider.location.lat.toFixed(6)}, {rider.location.lng.toFixed(6)}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className={`text-xs px-2 py-1 rounded border ${freshnessColor}`}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {calculateTimeSinceUpdate(rider.lastLocationUpdate)}
                                  {freshness === 'fresh' && ' (Live)'}
                                </div>
                              </div>
                            )}

                            {rider.assignedOrders && rider.assignedOrders.length > 0 && (
                              <div className="flex items-center space-x-1 text-sm">
                                <Package className="h-3 w-3 text-orange-500" />
                                <span className="text-orange-700">
                                  {rider.assignedOrders.length} assigned order(s)
                                </span>
                              </div>
                            )}

                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openInGoogleMaps(rider);
                                }}
                                className="flex-1"
                              >
                                <Navigation className="h-3 w-3 mr-1" />
                                View on Map
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {activeRiders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No active riders</p>
                      <p className="text-sm">Riders will appear here when they go active</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Rider Details */}
            {selectedRider && (
              <Card className="mt-4 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Selected Rider Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-medium">Name</Label>
                      <p>{selectedRider.name}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Phone</Label>
                      <p>{selectedRider.phone}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Current Location</Label>
                      <p className="text-sm">
                        {selectedRider.location ? 
                          `${selectedRider.location.lat.toFixed(6)}, ${selectedRider.location.lng.toFixed(6)}` : 
                          'Location not available'
                        }
                      </p>
                    </div>
                    <div>
                      <Label className="font-medium">Last Update</Label>
                      <p className="text-sm">
                        {new Date(selectedRider.lastLocationUpdate).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="font-medium">Assigned Orders</Label>
                      <p>{selectedRider.assignedOrders?.length || 0}</p>
                    </div>
                    <div>
                      <Label className="font-medium">Status</Label>
                      <Badge variant="default" className="bg-green-500">
                        {selectedRider.status} & Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
