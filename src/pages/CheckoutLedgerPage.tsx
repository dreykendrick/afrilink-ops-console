import { useEffect, useState } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';

interface LedgerEntry {
  id: string;
  date: string;
  orderId: string;
  type: string;
  recipientType: string;
  recipientId: string;
  amount: number;
  status: string;
  [key: string]: unknown;
}

export default function CheckoutLedgerPage() {
  const { callApi } = useCheckoutApi();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [recipientTypeFilter, setRecipientTypeFilter] = useState('all');

  const fetchLedger = async () => {
    setLoading(true);
    const qp: Record<string, string> = {};
    if (statusFilter !== 'all') qp.status = statusFilter;
    if (recipientTypeFilter !== 'all') qp.recipientType = recipientTypeFilter;

    const { data } = await callApi<LedgerEntry[] | { entries: LedgerEntry[] }>({
      path: '/admin/ledger',
      queryParams: qp,
    });
    const list = Array.isArray(data) ? data : (data as any)?.entries ?? [];
    setEntries(list);
    setLoading(false);
  };

  useEffect(() => { fetchLedger(); }, [statusFilter, recipientTypeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkout Ledger</h1>
        <p className="text-muted-foreground">Commission and payout ledger entries</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recipientTypeFilter} onValueChange={setRecipientTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Recipient Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
            <SelectItem value="platform">Platform</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchLedger} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <LoadingState message="Loading ledger..." />
      ) : entries.length === 0 ? (
        <EmptyState title="No ledger entries" description="No entries match your filters." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Recipient Type</TableHead>
                <TableHead>Recipient ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{e.date ? format(new Date(e.date), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">{e.orderId || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                  <TableCell>{e.recipientType || '—'}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">{e.recipientId || '—'}</TableCell>
                  <TableCell className="font-medium">₦{Number(e.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'paid' ? 'default' : e.status === 'pending' ? 'secondary' : 'destructive'}>
                      {e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
