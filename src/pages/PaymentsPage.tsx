import { useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import { CreditCard, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Payout { id: string; payout_reference: string; recipient_type: string; recipient_name: string; amount: number; status: string; created_at: string; }

export default function PaymentsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchPayouts(); }, []);

  const fetchPayouts = async () => {
    setIsLoading(true);
    // Try 'payouts' first, then 'vendor_payouts'
    let { data, error } = await externalSupabase.from('payouts').select('*').order('created_at', { ascending: false });
    if (error) {
      const res = await externalSupabase.from('vendor_payouts').select('*').order('created_at', { ascending: false });
      data = res.data;
      error = res.error;
    }
    if (error) { 
      console.error('Error fetching payouts:', error);
      // Show empty state instead of error if table doesn't exist
      setPayouts([]);
    } else { 
      // Map to expected format
      const mapped = (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        payout_reference: p.payout_reference as string || p.reference as string || `PAY-${(p.id as string)?.slice(0, 8)}`,
        recipient_type: p.recipient_type as string || 'vendor',
        recipient_name: p.recipient_name as string || p.vendor_name as string || 'Unknown',
        amount: p.amount as number || 0,
        status: p.status as string || 'pending',
        created_at: p.created_at as string,
      }));
      setPayouts(mapped); 
    }
    setIsLoading(false);
  };

  const filtered = payouts.filter((p) => statusFilter === 'all' || p.status === statusFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Payments & Payouts</h1><p className="text-muted-foreground">View payout queue and history</p></div>
        <Button onClick={fetchPayouts} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <div className="filter-bar">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-input border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem><SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton rows={6} cols={5} /> : filtered.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payouts found" description="Payouts will appear here when vendors are due payment" />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="admin-table"><thead className="bg-secondary/50"><tr><th>Reference</th><th>Recipient</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>{filtered.map((p) => (
              <tr key={p.id}><td className="font-mono text-primary">{p.payout_reference}</td><td className="text-foreground">{p.recipient_name}</td>
                <td className="text-muted-foreground capitalize">{p.recipient_type}</td><td className="text-foreground font-medium">{formatCurrency(p.amount)}</td>
                <td><StatusChip status={p.status} /></td><td className="text-muted-foreground">{formatRelativeDate(p.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
