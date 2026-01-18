import React, { useEffect, useRef, useState } from "react";
import { Loader as GoogleLoader } from "@googlemaps/js-api-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCTION_CONFIG } from "@/config/production";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Download,
  Filter,
  TrendingUp,
  IndianRupee,
  Package,
  Loader,
} from "lucide-react";
import { toast } from "sonner";

interface MapMarker {
  id: string;
  orderId: string;
  lat: number;
  lng: number;
  amount: number;
  status: string;
  date: string;
  address: string;
}

interface AreaStats {
  totalOrders: number;
  totalAmount: number;
  avgAmount: number;
  statusBreakdown: Record<string, number>;
  orders: Array<{ id: string; orderId: string; amount: number; status: string; date: string }>;
}

// Helper to load Google Maps API with caching
let googleMapsLoaded: any = null;
const getGoogleMaps = async () => {
  if (googleMapsLoaded) return googleMapsLoaded;

  const apiKey = PRODUCTION_CONFIG.GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY environment variable."
    );
  }

  const loader = new GoogleLoader({
    apiKey,
    version: "weekly",
    libraries: ["places"],
  });

  googleMapsLoaded = await loader.load();
  return googleMapsLoaded;
};

const AdminMapAnalytics: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(
    new Set([`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`])
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [polygon, setPolygon] = useState<Array<[number, number]>>([]);
  const [areaStats, setAreaStats] = useState<AreaStats | null>(null);
  const [totalStats, setTotalStats] = useState({ total: 0, amount: 0 });
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMap = async () => {
      try {
        setMapLoading(true);
        setMapError(null);

        const google = await getGoogleMaps();

        const mapInstance = new google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 28.6139, lng: 77.209 }, // Default to Delhi
          mapTypeId: "roadmap",
        });

        setMap(mapInstance);
        setMapLoading(false);
        fetchMapOrders();
      } catch (error) {
        console.error("Error loading Google Maps API:", error);
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Failed to load map. Please check your API key.";
        setMapError(errorMsg);
        setMapLoading(false);
        toast.error(errorMsg);
      }
    };

    initializeMap();

    return () => {
      // Cleanup
    };
  }, []);

  // Helper functions for month formatting
  const getMonthYearDisplay = (monthYearKey: string): string => {
    if (!monthYearKey) return "";
    const [year, month] = monthYearKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  };

  const toggleMonth = (monthYearKey: string) => {
    const newSelectedMonths = new Set(selectedMonths);
    if (newSelectedMonths.has(monthYearKey)) {
      newSelectedMonths.delete(monthYearKey);
    } else {
      newSelectedMonths.add(monthYearKey);
    }
    setSelectedMonths(newSelectedMonths);
  };

  // Generate all available month-year combinations for the past 24 months
  const generateAvailableMonths = () => {
    const months: string[] = [];
    const today = new Date();

    for (let i = 0; i < 24; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    return months;
  };

  const availableMonths = generateAvailableMonths();

  // Fetch orders when filters change
  useEffect(() => {
    if (map) {
      fetchMapOrders();
      setPolygon([]);
      setAreaStats(null);
    }
  }, [selectedMonths, selectedStatus, map]);

  // Fetch orders with location data
  const fetchMapOrders = async () => {
    try {
      setLoading(true);

      if (selectedMonths.size === 0) {
        toast.error("Please select at least one month");
        setLoading(false);
        return;
      }

      // Convert Set to array and sort
      const sortedMonths = Array.from(selectedMonths).sort();

      // Extract unique years from selected months
      const yearsSet = new Set(sortedMonths.map((m) => m.split('-')[0]));
      const years = Array.from(yearsSet).join(',');

      // Extract months: convert from "YYYY-MM" to "MM" for each month
      const monthsForApi = sortedMonths.map((m) => m.split('-')[1]).join(',');

      const response = await fetch(
        `/api/admin/analytics/map-orders?months=${monthsForApi}&years=${years}&status=${selectedStatus}`
      );

      if (response.ok) {
        const data = await response.json();
        setMarkers(data.markers || []);
        setTotalStats({
          total: data.total || 0,
          amount: data.totalAmount || 0,
        });

        // Clear existing markers
        if (map) {
          plotMarkers(data.markers || []);
        }
      }
    } catch (error) {
      console.error("Error fetching map orders:", error);
      toast.error("Failed to fetch map data");
    } finally {
      setLoading(false);
    }
  };

  // Plot markers on map
  const plotMarkers = async (markersData: MapMarker[]) => {
    if (!map) return;

    try {
      const google = await getGoogleMaps();

      // Clear old markers (simple approach - create new map instance)
      const infoWindows: any[] = [];

      markersData.forEach((marker) => {
        const markerColor = getMarkerColor(marker.status);

        const googleMarker = new google.maps.Marker({
          position: { lat: marker.lat, lng: marker.lng },
          map,
          title: marker.orderId,
          icon: `http://maps.google.com/mapfiles/ms/icons/${markerColor}-dot.png`,
        });

        // Create info window for each marker
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; font-family: Arial;">
              <h4 style="margin: 0 0 8px 0; color: #333;">${marker.orderId}</h4>
              <p style="margin: 4px 0; font-size: 13px;"><strong>₹${marker.amount}</strong></p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">${marker.status}</p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">${marker.address}</p>
            </div>
          `,
        });

        googleMarker.addListener("click", () => {
          // Close all other info windows
          infoWindows.forEach((iw) => iw.close());
          infoWindow.open(map, googleMarker);
        });

        infoWindows.push(infoWindow);
      });

      // Fit bounds to show all markers
      if (markersData.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markersData.forEach((m) => {
          bounds.extend({ lat: m.lat, lng: m.lng });
        });
        map.fitBounds(bounds);
      }
    } catch (error) {
      console.error("Error plotting markers:", error);
    }
  };

  // Get color based on order status
  const getMarkerColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      pending: "red",
      confirmed: "yellow",
      picked_up: "blue",
      in_transit: "orange",
      delivered: "green",
      completed: "green",
      cancelled: "gray",
    };
    return colorMap[status] || "blue";
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    setDrawingMode(!drawingMode);
    setPolygon([]);
    setAreaStats(null);

    if (map && !drawingMode) {
      map.setOptions({ draggableCursor: "crosshair" });
    } else if (map) {
      map.setOptions({ draggableCursor: "grab" });
    }
  };

  // Handle map click when drawing
  useEffect(() => {
    if (!map || !drawingMode) return;

    const setupDrawing = async () => {
      try {
        const google = await getGoogleMaps();

        const clickListener = map.addListener("click", (event: any) => {
          const newPoint: [number, number] = [event.latLng.lng(), event.latLng.lat()];
          setPolygon([...polygon, newPoint]);

          // Plot the point on map
          new google.maps.Marker({
            position: { lat: newPoint[1], lng: newPoint[0] },
            map,
            title: `Point ${polygon.length + 1}`,
          });
        });

        // Store listener for cleanup
        (map as any).__drawingListener = clickListener;
      } catch (error) {
        console.error("Error setting up drawing mode:", error);
      }
    };

    setupDrawing();

    return () => {
      const listener = (map as any).__drawingListener;
      if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [map, drawingMode, polygon]);

  // Draw polygon on map
  useEffect(() => {
    if (!map || polygon.length < 2) return;

    const drawPolygon = async () => {
      try {
        const google = await getGoogleMaps();

        // Remove previous polyline
        const existingPolyline = (map as any).polyline;
        if (existingPolyline) existingPolyline.setMap(null);

        const polylineCoords = polygon.map((p) => ({
          lat: p[1],
          lng: p[0],
        }));

        if (polygon.length > 2) {
          polylineCoords.push({
            lat: polygon[0][1],
            lng: polygon[0][0],
          });
        }

        const polyline = new google.maps.Polygon({
          paths: polylineCoords,
          geodesic: true,
          strokeColor: "#9C27B0",
          strokeOpacity: 0.7,
          strokeWeight: 2,
          fillColor: "#9C27B0",
          fillOpacity: 0.2,
          map,
        });

        (map as any).polyline = polyline;
      } catch (error) {
        console.error("Error drawing polygon:", error);
      }
    };

    drawPolygon();
  }, [polygon, map]);

  // Analyze area
  const analyzeArea = async () => {
    if (polygon.length < 3) {
      toast.error("Please draw a polygon with at least 3 points");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/admin/analytics/area-stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          polygon,
          months: selectedMonths,
          year: selectedYear,
          status: selectedStatus,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAreaStats(data.areaStats);
        toast.success(`Found ${data.areaStats.totalOrders} orders in selected area`);
      }
    } catch (error) {
      console.error("Error analyzing area:", error);
      toast.error("Failed to analyze area");
    } finally {
      setLoading(false);
    }
  };

  // Generate months and years for selects
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) =>
    new Date().getFullYear() - i
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Map Analytics</h2>
        <p className="text-gray-600 mt-1">
          Visualize orders on map by location and analyze area performance
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Months (Supports Multi-Year)
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowMonthSelector(!showMonthSelector)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left text-sm font-normal hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-laundrify-purple/50"
                  >
                    {selectedMonths.size === 1
                      ? getMonthYearDisplay(Array.from(selectedMonths)[0])
                      : `${selectedMonths.size} months selected`}
                  </button>

                  {showMonthSelector && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-96 overflow-y-auto">
                      {availableMonths.map((monthYear) => (
                        <label
                          key={monthYear}
                          className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMonths.has(monthYear)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                toggleMonth(monthYear);
                              } else {
                                toggleMonth(monthYear);
                              }
                            }}
                            className="rounded border-gray-300 text-laundrify-purple focus:ring-laundrify-purple cursor-pointer"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {getMonthYearDisplay(monthYear)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected months pills */}
                {selectedMonths.size > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from(selectedMonths).sort().reverse().map((monthYear) => (
                      <div
                        key={monthYear}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-laundrify-purple/10 text-laundrify-purple rounded-full text-xs font-medium"
                      >
                        {getMonthYearDisplay(monthYear)}
                        <button
                          onClick={() => toggleMonth(monthYear)}
                          className="hover:text-laundrify-purple/70 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={fetchMapOrders}
                  disabled={loading || selectedMonths.size === 0}
                  className="w-full bg-laundrify-purple hover:bg-laundrify-purple/90 text-white"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Filter className="h-4 w-4 mr-2" />
                      Apply Filters
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Container */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Map Visualization</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={toggleDrawingMode}
                variant={drawingMode ? "default" : "outline"}
                disabled={mapError !== null || mapLoading}
                className={
                  drawingMode
                    ? "bg-laundrify-purple text-white"
                    : "border-laundrify-purple text-laundrify-purple"
                }
              >
                {drawingMode ? "Drawing..." : "Draw Area"}
              </Button>
              {polygon.length > 0 && (
                <>
                  <Button
                    onClick={analyzeArea}
                    disabled={polygon.length < 3 || loading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Analyze Area
                  </Button>
                  <Button
                    onClick={() => {
                      setPolygon([]);
                      setAreaStats(null);
                      setDrawingMode(false);
                      if (map) map.setOptions({ draggableCursor: "grab" });
                    }}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {mapError
              ? "❌ Failed to load map"
              : drawingMode && polygon.length === 0
                ? "Click on the map to start drawing a polygon..."
                : drawingMode && polygon.length > 0
                  ? `Polygon points: ${polygon.length} (min 3 required)`
                  : "Showing all orders with location data"}
          </p>
        </CardHeader>
        <CardContent>
          {mapError ? (
            <div className="w-full h-96 bg-red-50 border-2 border-red-200 rounded-lg flex items-center justify-center flex-col gap-4">
              <div className="text-center">
                <p className="text-red-800 font-semibold mb-2">Map Loading Error</p>
                <p className="text-red-600 text-sm mb-4">{mapError}</p>
                <p className="text-gray-600 text-xs">
                  Please ensure VITE_GOOGLE_MAPS_API_KEY environment variable is set
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={mapRef}
              style={{
                width: "100%",
                height: "600px",
                borderRadius: "8px",
                overflow: "hidden",
                backgroundColor: "#f0f0f0",
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {selectedMonths && selectedYear
                ? selectedMonths.length === 1
                  ? `${new Date(parseInt(selectedYear), parseInt(selectedMonths[0]) - 1).toLocaleString("default", { month: "long", year: "numeric" })}`
                  : `${selectedMonths.length} months in ${selectedYear}`
                : "Selected period"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalStats.amount.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Revenue
            </p>
          </CardContent>
        </Card>

        {areaStats && (
          <Card className="border-laundrify-purple">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-laundrify-purple">
                Area Statistics
              </CardTitle>
              <MapPin className="h-4 w-4 text-laundrify-purple" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-laundrify-purple">
                {areaStats.totalOrders} orders
              </div>
              <p className="text-xs text-muted-foreground">
                ₹{areaStats.totalAmount.toFixed(0)} ({areaStats.avgAmount.toFixed(0)}/order)
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Area Details */}
      {areaStats && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Area Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Status Breakdown */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Orders by Status</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(areaStats.statusBreakdown).map(([status, count]) => (
                    <div
                      key={status}
                      className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200"
                    >
                      <p className="text-2xl font-bold text-laundrify-purple">
                        {count}
                      </p>
                      <p className="text-sm text-gray-600 capitalize">{status}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orders List */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">
                  Orders in Selected Area ({areaStats.orders.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Order ID
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Amount
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaStats.orders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {order.orderId}
                          </td>
                          <td className="py-3 px-4">₹{order.amount}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(order.date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Color Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Marker Color Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { status: "Pending", color: "red" },
              { status: "Confirmed", color: "yellow" },
              { status: "In Transit", color: "orange" },
              { status: "Delivered", color: "green" },
              { status: "Cancelled", color: "gray" },
            ].map(({ status, color }) => (
              <div key={status} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor:
                      {
                        red: "#FF0000",
                        yellow: "#FFFF00",
                        orange: "#FFA500",
                        green: "#00AA00",
                        gray: "#808080",
                      }[color] || "#0000FF",
                  }}
                />
                <span className="text-sm text-gray-600">{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMapAnalytics;
