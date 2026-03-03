import { useEffect, useState } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';

interface Order {
  id: string;
  orderId: string;
  date: string;
  status: string;
  total: number;
  source: string;
  buyerRole: string;
  vendorId: string;
  affiliateId: string;
  [key: string]: unknown;
}

export default function CheckoutOrdersPage() {
  const { callApi } = useCheckoutApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    const qp: Record<string, string> = {};
    if (statusFilter !== 'all') qp.status = statusFilter;
    if (searchQuery) qp.search = searchQuery;

    const { data } = await callApi<Order[] | { orders: Order[] }>({
      path: '/admin/orders',
      queryParams: qp,
    });
    const list = Array.isArray(data) ? data : (data as any)?.orders ?? [];
    setOrders(list);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const statusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'delivered': case 'completed': return 'default';
      case 'pending': case 'processing': return 'secondary';
      case 'cancelled': case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkout Orders</h1>
        <p className="text-muted-foreground">Orders from the checkout system</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
            className="pl-9 w-48"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchOrders} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <LoadingState message="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders found" description="No orders match your filters." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Buyer Role</TableHead>
                <TableHead>Vendor ID</TableHead>
                <TableHead>Affiliate ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id || o.orderId}>
                  <TableCell className="font-mono text-xs">{o.orderId || o.id || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{o.date ? format(new Date(o.date), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell><Badge variant={statusColor(o.status)}>{o.status}</Badge></TableCell>
                  <TableCell className="font-medium">₦{Number(o.total || 0).toLocaleString()}</TableCell>
                  <TableCell>{o.source || '—'}</TableCell>
                  <TableCell>{o.buyerRole || '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate">{o.vendorId || '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate">{o.affiliateId || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setSelected(o)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {Object.entries(selected).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-medium text-right truncate max-w-[250px]">{String(value ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
