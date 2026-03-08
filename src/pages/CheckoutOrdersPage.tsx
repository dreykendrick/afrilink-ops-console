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
import { OrderSourceBadge } from '@/components/OrderSourceBadge';
import { CommissionBreakdown } from '@/components/CommissionBreakdown';

interface Order {
  id: string;
  orderId: string;
  date: string;
  status: string;
  total: number;
  source: string;
  orderSource: string;
  buyerRole: string;
  vendorId: string;
  affiliateId: string;
  vendorShare: number;
  affiliateCommission: number;
  platformFee: number;
  deliveryType: string;
  deliveryCost: number;
  fundsReleased: boolean;
  vendorConfirmed: boolean;
  consumerConfirmed: boolean;
  [key: string]: unknown;
}

export default function CheckoutOrdersPage() {
  const { callApi } = useCheckoutApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    const qp: Record<string, string> = {};
    if (statusFilter !== 'all') qp.status = statusFilter;
    if (sourceFilter !== 'all') qp.orderSource = sourceFilter;
    if (searchQuery) qp.search = searchQuery;

    const { data } = await callApi<Order[] | { orders: Order[] }>({
      path: '/admin/orders',
      queryParams: qp,
    });
    const list = Array.isArray(data) ? data : (data as any)?.orders ?? [];
    setOrders(list);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [statusFilter, sourceFilter]);

  const statusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'delivered': case 'completed': return 'default';
      case 'pending': case 'processing': case 'paid': case 'shipped': return 'secondary';
      case 'cancelled': case 'failed': case 'refunded': return 'destructive';
      case 'disputed': return 'destructive';
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
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="SHIPPED">Shipped</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
            <SelectItem value="DISPUTED">Disputed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="MARKETPLACE">Marketplace</SelectItem>
            <SelectItem value="AFFILIATE">Affiliate</SelectItem>
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
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Vendor Share</TableHead>
                <TableHead>Affiliate</TableHead>
                <TableHead>Platform Fee</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id || o.orderId}>
                  <TableCell className="font-mono text-xs">{o.orderId || o.id || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{o.date ? format(new Date(o.date), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell><OrderSourceBadge source={o.orderSource || o.source} /></TableCell>
                  <TableCell><Badge variant={statusColor(o.status)}>{o.status}</Badge></TableCell>
                  <TableCell className="font-medium">TSh{Number(o.total || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">TSh{Number(o.vendorShare || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">
                    {o.orderSource?.toUpperCase() === 'AFFILIATE' ? (
                      <span>TSh{Number(o.affiliateCommission || 0).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">TSh{Number(o.platformFee || 0).toLocaleString()}</TableCell>
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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {/* Source badge */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Order Source:</span>
                <OrderSourceBadge source={selected.orderSource || selected.source} />
              </div>

              {/* Key fields */}
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Order ID</span><span className="font-mono">{selected.orderId || selected.id}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={statusColor(selected.status)}>{selected.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">TSh{Number(selected.total || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vendor ID</span><span className="font-mono text-xs truncate max-w-[200px]">{selected.vendorId || '—'}</span></div>
                {selected.orderSource?.toUpperCase() === 'AFFILIATE' && selected.affiliateId && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Affiliate ID</span><span className="font-mono text-xs truncate max-w-[200px]">{selected.affiliateId}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery Type</span><span>{selected.deliveryType || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery Cost</span><span>TSh{Number(selected.deliveryCost || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Funds Released</span><span>{selected.fundsReleased ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Vendor Confirmed</span><span>{selected.vendorConfirmed ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Consumer Confirmed</span><span>{selected.consumerConfirmed ? 'Yes' : 'No'}</span></div>
              </div>

              {/* Commission breakdown */}
              <div className="pt-3 border-t border-border">
                <p className="text-sm font-semibold text-foreground mb-2">Commission Breakdown</p>
                <CommissionBreakdown
                  vendorShare={selected.vendorShare}
                  affiliateCommission={selected.affiliateCommission}
                  platformFee={selected.platformFee}
                  orderSource={selected.orderSource}
                  className="space-y-1"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
