import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Package, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

interface OrderData {
  _id: string;
  custom_order_id: string;
  name: string;
  phone: string;
  service: string;
  status: string;
  final_amount: number;
  scheduled_date: string;
  assignedVendor?: string;
}

interface DailyOrders {
  [date: string]: OrderData[];
}

interface VendorDailyStats {
  vendor: string;
  daily_orders: DailyOrders;
  dates: string[];
}

const AdminDailyOrdersView: React.FC = () => {
  const [vendorStats, setVendorStats] = useState<VendorDailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [viewMode, setViewMode] = useState<'today' | 'date-range'>('today');
  const [dateRangeStart, setDateRangeStart] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(new Date().toISOString().split('T')[0]);

  // Fetch orders on component mount and when filters change
  useEffect(() => {
    fetchPickupOrders();
  }, [selectedDate, dateRangeStart, dateRangeEnd]);

  const fetchPickupOrders = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      params.append('status', 'pickup_completed');
      params.append('limit', '1000');

      if (viewMode === 'today') {
        params.append('startDate', selectedDate);
        params.append('endDate', selectedDate);
      } else {
        params.append('startDate', dateRangeStart);
        params.append('endDate', dateRangeEnd);
      }

      const response = await apiClient.adminRequest<{ bookings?: any[] }>(
        `/admin/bookings?${params.toString()}`
      );

      if (response.data && response.data.bookings) {
        const bookings: OrderData[] = response.data.bookings;

        // Group bookings by vendor and then by date
        const groupedByVendor: Record<string, DailyOrders> = {};

        bookings.forEach(booking => {
          const vendor = booking.assignedVendor || 'Unassigned';
          const date = booking.scheduled_date?.split('T')[0] || new Date().toISOString().split('T')[0];

          if (!groupedByVendor[vendor]) {
            groupedByVendor[vendor] = {};
          }

          if (!groupedByVendor[vendor][date]) {
            groupedByVendor[vendor][date] = [];
          }

          groupedByVendor[vendor][date].push(booking);
        });

        // Convert to array and sort dates
        const stats: VendorDailyStats[] = Object.entries(groupedByVendor)
          .map(([vendor, daily_orders]) => ({
            vendor,
            daily_orders,
            dates: Object.keys(daily_orders).sort().reverse(),
          }))
          .sort((a, b) => {
            // Sort vendors: Unassigned last, others alphabetically
            if (a.vendor === 'Unassigned') return 1;
            if (b.vendor === 'Unassigned') return -1;
            return a.vendor.localeCompare(b.vendor);
          });

        setVendorStats(stats);

        // Auto-select first vendor if not already selected
        if (stats.length > 0 && !selectedVendor) {
          setSelectedVendor(stats[0].vendor);
        }

        // Show summary
        const totalOrders = bookings.length;
        const totalAmount = bookings.reduce((sum, o) => sum + (o.final_amount || 0), 0);
        console.log(`✅ Fetched ${totalOrders} pickup orders (${stats.length} vendors) - Total: ₹${totalAmount}`);
      }
    } catch (error) {
      console.error('Error fetching pickup orders:', error);
      toast.error('Failed to fetch pickup orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase?.().replace(/\s+/g, '_') || '';
    switch (normalizedStatus) {
      case 'pickup_completed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateOnly = date.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (dateOnly === todayStr) return 'Today';
      if (dateOnly === yesterdayStr) return 'Yesterday';

      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const navigateDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const currentVendorStats = vendorStats.find(s => s.vendor === selectedVendor);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-600">Loading pickup orders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (vendorStats.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">No pickup orders found</p>
            {viewMode === 'today' ? (
              <p className="text-sm text-gray-500">No orders were picked up on {formatDate(selectedDate)}</p>
            ) : (
              <p className="text-sm text-gray-500">
                No orders were picked up between {formatDate(dateRangeStart)} and {formatDate(dateRangeEnd)}
              </p>
            )}
            <Button onClick={fetchPickupOrders} variant="outline" className="mt-4">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title and Description */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Daily Pickup Orders</h2>
        <p className="text-gray-600 mt-1">
          View vendor pickup activities and check daily pickup statistics
        </p>
      </div>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
          <CardDescription>View pickup orders for a specific date or date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="radio"
              id="view-today"
              name="viewMode"
              value="today"
              checked={viewMode === 'today'}
              onChange={() => setViewMode('today')}
              className="cursor-pointer"
            />
            <label htmlFor="view-today" className="cursor-pointer font-medium">
              Today's Pickups
            </label>

            <input
              type="radio"
              id="view-range"
              name="viewMode"
              value="date-range"
              checked={viewMode === 'date-range'}
              onChange={() => setViewMode('date-range')}
              className="cursor-pointer ml-6"
            />
            <label htmlFor="view-range" className="cursor-pointer font-medium">
              Date Range
            </label>
          </div>

          {viewMode === 'today' ? (
            // Single date picker
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <Button
                onClick={() => navigateDate(-1)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-3 flex-1">
                <Calendar className="h-4 w-4 text-gray-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Badge variant="outline" className="whitespace-nowrap">
                  {formatDate(selectedDate)}
                </Badge>
              </div>

              <Button
                onClick={() => navigateDate(1)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            // Date range picker
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendor Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>Select a vendor to view their pickup details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {vendorStats.map(stat => (
              <Button
                key={stat.vendor}
                onClick={() => setSelectedVendor(stat.vendor)}
                variant={selectedVendor === stat.vendor ? 'default' : 'outline'}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                <span>{stat.vendor}</span>
                <Badge variant="secondary" className="ml-2">
                  {Object.keys(stat.daily_orders).length} days
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Pickup Orders */}
      {currentVendorStats && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Pickup Details - {currentVendorStats.vendor}
            </h3>
            <Badge className="bg-purple-100 text-purple-800 text-base px-3 py-1">
              {currentVendorStats.dates.length} days
            </Badge>
          </div>

          {currentVendorStats.dates.map(date => {
            const orders = currentVendorStats.daily_orders[date];
            const dateLabel = formatDate(date);
            const isToday = new Date(date).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];

            return (
              <Card key={date} className={isToday ? 'border-purple-200 bg-purple-50' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{dateLabel}</CardTitle>
                      {isToday && <Badge className="bg-purple-600">Today</Badge>}
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {orders.length} pickups
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Total: ₹{orders.reduce((sum, o) => sum + (o.final_amount || 0), 0).toLocaleString('en-IN')}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {orders.length === 0 ? (
                      <p className="text-gray-500 text-sm">No pickups for this day</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left py-3 px-3 font-semibold text-gray-700">Order ID</th>
                              <th className="text-left py-3 px-3 font-semibold text-gray-700">Customer</th>
                              <th className="text-left py-3 px-3 font-semibold text-gray-700">Service</th>
                              <th className="text-left py-3 px-3 font-semibold text-gray-700">Amount</th>
                              <th className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map(order => (
                              <tr key={order._id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-3 font-medium text-purple-600">{order.custom_order_id}</td>
                                <td className="py-3 px-3">
                                  <div className="text-sm font-medium text-gray-900">{order.name}</div>
                                  <div className="text-xs text-gray-500">{order.phone}</div>
                                </td>
                                <td className="py-3 px-3 text-sm text-gray-700">{order.service}</td>
                                <td className="py-3 px-3 font-semibold text-gray-900">
                                  ₹{(order.final_amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 px-3">
                                  <Badge className={getStatusColor(order.status)}>
                                    {order.status.replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDailyOrdersView;
