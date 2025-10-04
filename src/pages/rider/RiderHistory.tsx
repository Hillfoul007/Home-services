import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getRiderApiUrl } from '@/lib/riderApi';
import { format } from 'date-fns';

export default function RiderHistory() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (p = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('riderToken');
      const url = getRiderApiUrl(`/orders/history?page=${p}&limit=${limit}`);
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        console.warn('Failed to fetch history, using empty');
        setOrders([]);
        setTotal(0);
        return;
      }
      const data = await res.json();
      setOrders(Array.isArray(data.data) ? data.data : data.data || []);
      setTotal(data.total || 0);
      setPage(data.page || p);
    } catch (e) {
      console.error('Fetch history error', e);
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil((total || orders.length) / limit));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Completed Deliveries</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/rider/dashboard')}>Back</Button>
          <Button onClick={() => fetchHistory(page)}>Refresh</Button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">No completed deliveries found.</p>
              </CardContent>
            </Card>
          ) : orders.map((o) => (
            <Card key={o._id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{o.customerName || 'Customer'}</div>
                    <div className="text-xs text-muted-foreground">{o.bookingId || ''} • {o.type || ''}</div>
                  </div>
                  <div className="text-sm">{o.completedAt ? format(new Date(o.completedAt), 'dd MMM yyyy, hh:mm a') : ''}</div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm">{o.address}</div>
                    <div className="text-sm text-muted-foreground">{o.customerPhone}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-sm font-semibold">₹{o.finalAmount || 0}</div>
                    <div className="mt-2">
                      <Button size="sm" onClick={() => navigate(`/rider/orders/${o._id}`)}>View</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { const np = Math.max(1, page - 1); fetchHistory(np); }}>
                Prev
              </Button>
              <div className="text-sm">Page {page} of {totalPages}</div>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => { const np = Math.min(totalPages, page + 1); fetchHistory(np); }}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
