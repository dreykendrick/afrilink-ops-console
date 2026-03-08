import { useEffect, useState, useCallback } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { toast } from '@/hooks/use-toast';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusChip } from '@/components/StatusChip';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RefreshCw, ArrowDownToLine } from 'lucide-react';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';

interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  amount: number;
  payoutMethod: string;
  accountDetails: string;
  phone: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
}

export default function CheckoutWithdrawalsPage() {
  const { callApi, isLoading } = useCheckoutApi();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionDialog, setActionDialog] = useState<{ open: boolean; id: string; action: string }>({ open: false, id: '', action: '' });

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;

    const { data } = await callApi<Withdrawal[] | { withdrawals: Withdrawal[] }>({
      path: '/admin/withdrawals',
      queryParams: params,
      showErrorToast: false,
    });

    const list = Array.isArray(data) ? data : (data as any)?.withdrawals ?? [];
    setWithdrawals(list);
    setLoading(false);
  }, [callApi, statusFilter]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleStatusAction = async () => {
    const { id, action } = actionDialog;
    const { error } = await callApi({
      path: `/admin/withdrawals/${id}/status`,
      method: 'PUT',
      payload: { status: action },
    });
    if (!error) {
      toast({ title: 'Updated', description: `Withdrawal marked as ${action}` });
      fetchWithdrawals();
    }
    setActionDialog({ open: false, id: '', action: '' });
  };

  const openAction = (id: string, action: string) => {
    setActionDialog({ open: true, id, action });
  };

  // Status filtering is done server-side via query params, so use full list
  const filtered = withdrawals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Withdrawals</h1>
          <p className="text-muted-foreground">Monitor and manage withdrawal requests</p>
        </div>
        <Button onClick={fetchWithdrawals} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState message="Loading withdrawals..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowDownToLine} title="No withdrawals found" description="Withdrawal requests will appear here when users request payouts." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Account / Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium text-foreground">{w.userName || w.userId}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{w.userRole}</TableCell>
                  <TableCell className="font-medium text-foreground">{formatCurrency(w.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{w.payoutMethod || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {w.accountDetails || w.phone || '—'}
                  </TableCell>
                  <TableCell><StatusChip status={w.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeDate(w.createdAt)}</TableCell>
                  <TableCell>
                    {(w.status === 'PENDING' || w.status === 'pending') && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openAction(w.id, 'PROCESSING')}>
                          Process
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openAction(w.id, 'REJECTED')}>
                          Reject
                        </Button>
                      </div>
                    )}
                    {(w.status === 'PROCESSING' || w.status === 'processing') && (
                      <Button size="sm" variant="outline" onClick={() => openAction(w.id, 'COMPLETED')}>
                        Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={actionDialog.open}
        onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}
        title={`Mark as ${actionDialog.action}?`}
        description={`This will update the withdrawal status to ${actionDialog.action}. This action is logged.`}
        confirmLabel="Confirm"
        onConfirm={handleStatusAction}
        variant={actionDialog.action === 'REJECTED' ? 'destructive' : 'default'}
      />
    </div>
  );
}
