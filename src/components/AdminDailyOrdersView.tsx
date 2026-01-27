import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import { formatDateOnlyIST } from '@/utils/timeUtils';

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
  const [viewMode, setViewMode] = useState<'today' | 'range'>('today');

  useEffect(() => {
    fetchDailyOrders();
  }, []);

  const fetchDailyOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.adminRequest<{ bookings?: any[] }>('/admin/bookings?limit=500');
      
      if (response.data) {
        const bookings: OrderData[] = response.data.bookings || [];
        
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
        const stats: VendorDailyStats[] = Object.entries(groupedByVendor).map(([vendor, daily_orders]) => ({
          vendor,
          daily_orders,
          dates: Object.keys(daily_orders).sort().reverse(),
        }));

        setVendorStats(stats);
        
        // Auto-select first vendor
        if (stats.length > 0) {
          setSelectedVendor(stats[0].vendor);
        }
      }
    } catch (error) {
      console.error('Error fetching daily orders:', error);
      toast.error('Failed to fetch daily orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase?.().replace(/\s+/g, '_') || '';
    switch (normalizedStatus) {
      case 'created':
        return 'bg-yellow-100 text-yellow-800';
      case 'vendor_assigned':
        return 'bg-green-100 text-green-800';
      case 'pickup_completed':
        return 'bg-purple-100 text-purple-800';
      case 'ready_for_delivery':
        return 'bg-sky-100 text-sky-800';
      case 'delivered':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
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
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const currentVendorStats = vendorStats.find(s => s.vendor === selectedVendor);
  
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-600">Loading daily orders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (vendorStats.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-gray-600">
            <p>No orders found</p>
            <Button onClick={fetchDailyOrders} variant="outline" className="mt-4">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vendor Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
          <CardDescription>Select a vendor to view their daily orders</CardDescription>
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
                <Badge variant="secondary" className="ml-2">{Object.keys(stat.daily_orders).length} days</Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Orders */}
      {currentVendorStats && (
        <div className="space-y-4">
          {currentVendorStats.dates.map(date => {
            const orders = currentVendorStats.daily_orders[date];
            const dateLabel = formatDate(date);
            const isToday = new Date(date).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            
            return (
              <Card key={date} className={isToday ? 'border-blue-200 bg-blue-50' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{dateLabel}</CardTitle>
                      {isToday && <Badge>Today</Badge>}
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {orders.length} orders
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Total: ₹{orders.reduce((sum, o) => sum + (o.final_amount || 0), 0).toLocaleString('en-IN')}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {orders.length === 0 ? (
                      <p className="text-gray-500 text-sm">No orders for this day</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-semibold">Order ID</th>
                              <th className="text-left py-2 px-2 font-semibold">Customer</th>
                              <th className="text-left py-2 px-2 font-semibold">Service</th>
                              <th className="text-left py-2 px-2 font-semibold">Amount</th>
                              <th className="text-left py-2 px-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map(order => (
                              <tr key={order._id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-2 font-medium text-blue-600">{order.custom_order_id}</td>
                                <td className="py-2 px-2">
                                  <div className="text-sm">{order.name}</div>
                                  <div className="text-xs text-gray-500">{order.phone}</div>
                                </td>
                                <td className="py-2 px-2 text-sm">{order.service}</td>
                                <td className="py-2 px-2 font-semibold">₹{(order.final_amount || 0).toLocaleString('en-IN')}</td>
                                <td className="py-2 px-2">
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
