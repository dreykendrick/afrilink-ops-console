import { useEffect, useState } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { toast } from '@/hooks/use-toast';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, RotateCcw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';

interface Payment {
  id: string;
  date: string;
  amount: number;
  status: string;
  providerReference: string;
  orderId: string;
  source: string;
  buyer: string;
  vendor: string;
  product: string;
  [key: string]: unknown;
}

export default function CheckoutPaymentsPage() {
  const { callApi, isLoading } = useCheckoutApi();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    const qp: Record<string, string> = {};
    if (statusFilter !== 'all') qp.status = statusFilter;
    if (sourceFilter !== 'all') qp.source = sourceFilter;
    if (dateFrom) qp.dateFrom = dateFrom;
    if (dateTo) qp.dateTo = dateTo;
    if (searchQuery) qp.search = searchQuery;

    const { data } = await callApi<Payment[] | { payments: Payment[] }>({
      path: '/admin/payments',
      queryParams: qp,
    });

    const list = Array.isArray(data) ? data : (data as any)?.payments ?? [];
    setPayments(list);
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, [statusFilter, sourceFilter, dateFrom, dateTo]);

  const handleRetryVerify = async (payment: Payment) => {
    setRetrying(payment.id);
    const { error } = await callApi({
      path: '/checkout/verify',
      method: 'POST',
      payload: { orderId: payment.orderId, providerReference: payment.providerReference },
    });
    if (!error) {
      toast({ title: 'Success', description: 'Verification retried successfully' });
      fetchPayments();
    }
    setRetrying(null);
  };

  const statusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'successful': case 'success': case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkout Payments</h1>
        <p className="text-muted-foreground">Payment transactions from the checkout system</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPayments()}
            className="pl-9 w-48"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="paystack">Paystack</SelectItem>
            <SelectItem value="flutterwave">Flutterwave</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        <Button variant="outline" onClick={fetchPayments} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Loading payments..." />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments found" description="No payment records match your filters." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider Ref</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{p.date ? format(new Date(p.date), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell className="font-medium">TSh{Number(p.amount || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={statusColor(p.status)}>{p.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">{p.providerReference || '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">{p.orderId || '—'}</TableCell>
                  <TableCell>{p.source || '—'}</TableCell>
                  <TableCell className="max-w-[100px] truncate">{p.buyer || '—'}</TableCell>
                  <TableCell className="max-w-[100px] truncate">{p.vendor || '—'}</TableCell>
                  <TableCell className="max-w-[100px] truncate">{p.product || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setSelected(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRetryVerify(p)}
                        disabled={retrying === p.id}
                      >
                        {retrying === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>
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
