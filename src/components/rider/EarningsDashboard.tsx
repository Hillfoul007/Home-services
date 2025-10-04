import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function EarningsDashboard({ daily = 0, weekly = 0, onRefresh }: { daily?: number; weekly?: number; onRefresh?: () => void }) {
  const exportCsv = async () => {
    try {
      const token = localStorage.getItem('riderToken');
      const url = '/api/riders/earnings/export';
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        throw new Error('Failed to export');
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `earnings.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      console.warn('Failed to export earnings', e);
      alert('Failed to export earnings');
    }
  };

  return (
    <Card className="mb-3">
      <CardHeader>
        <CardTitle>Earnings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Today</div>
            <div className="text-xl font-semibold">₹{daily}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">This Week</div>
            <div className="text-xl font-semibold">₹{weekly}</div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" onClick={onRefresh}>Refresh</Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
      </CardContent>
    </Card>
  );
}
