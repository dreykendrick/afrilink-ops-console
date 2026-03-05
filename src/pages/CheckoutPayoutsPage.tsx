import { useState } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Send } from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';

interface PayoutAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  [key: string]: unknown;
}

interface PayoutBatch {
  id: string;
  date: string;
  status: string;
  total: number;
  count: number;
  [key: string]: unknown;
}

export default function CheckoutPayoutsPage() {
  const { callApi, isLoading } = useCheckoutApi();

  // Manual Payout state
  const [recipientType, setRecipientType] = useState('vendor');
  const [recipientId, setRecipientId] = useState('');
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Scheduled state
  const [scheduleInterval, setScheduleInterval] = useState('weekly');
  const [minAmount, setMinAmount] = useState('1000');
  const [savingSettings, setSavingSettings] = useState(false);

  // Batches state
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const fetchRecipientData = async () => {
    if (!recipientId.trim()) return;
    setFetchingAccounts(true);

    const [accountsRes, balanceRes] = await Promise.all([
      callApi<PayoutAccount[] | { accounts: PayoutAccount[] }>({
        path: '/admin/payout-accounts',
        queryParams: { recipientId, recipientType },
      }),
      callApi<{ balance: number } | number>({
        path: '/admin/ledger',
        queryParams: { recipientId, recipientType, status: 'pending' },
      }),
    ]);

    const accts = Array.isArray(accountsRes.data) ? accountsRes.data : (accountsRes.data as any)?.accounts ?? [];
    setAccounts(accts);
    if (accts.length > 0) setSelectedAccount(accts[0].id);

    const bal = typeof balanceRes.data === 'number'
      ? balanceRes.data
      : (balanceRes.data as any)?.balance ?? (balanceRes.data as any)?.totalAmount ?? 0;
    setBalance(bal);
    setFetchingAccounts(false);
  };

  const handleManualPayout = async () => {
    if (!recipientId || !selectedAccount || !payoutAmount) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await callApi({
      path: '/admin/payouts/manual',
      method: 'POST',
      payload: {
        recipientId,
        recipientType,
        accountId: selectedAccount,
        amount: Number(payoutAmount),
      },
    });
    if (!error) {
      toast({ title: 'Success', description: 'Payout initiated successfully' });
      setPayoutAmount('');
      setBalance(null);
      setAccounts([]);
    }
    setSubmitting(false);
  };

  const handleSaveSchedule = async () => {
    setSavingSettings(true);
    const { error } = await callApi({
      path: '/admin/payout-settings',
      method: 'PUT',
      payload: { interval: scheduleInterval, minAmount: Number(minAmount) },
    });
    if (!error) {
      toast({ title: 'Saved', description: 'Payout schedule settings updated' });
    }
    setSavingSettings(false);
  };

  const fetchBatches = async () => {
    setLoadingBatches(true);
    const { data } = await callApi<PayoutBatch[] | { batches: PayoutBatch[] }>({
      path: '/admin/payout-batches',
    });
    const list = Array.isArray(data) ? data : (data as any)?.batches ?? [];
    setBatches(list);
    setLoadingBatches(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkout Payouts</h1>
        <p className="text-muted-foreground">Manage vendor and affiliate payouts</p>
      </div>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual Payout</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Payouts</TabsTrigger>
          <TabsTrigger value="batches" onClick={fetchBatches}>Batches</TabsTrigger>
        </TabsList>

        {/* Manual Payout */}
        <TabsContent value="manual" className="space-y-6 mt-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recipient Type</Label>
                <Select value={recipientType} onValueChange={setRecipientType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="affiliate">Affiliate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipient ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    placeholder="Enter ID"
                  />
                  <Button variant="outline" size="icon" onClick={fetchRecipientData} disabled={fetchingAccounts}>
                    {fetchingAccounts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {balance !== null && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-xl font-bold text-foreground">TSh{balance.toLocaleString()}</p>
              </div>
            )}

            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Payout Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bankName} — {a.accountNumber} ({a.accountName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount (TSh)</Label>
              <Input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <Button onClick={handleManualPayout} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Payout
            </Button>
          </div>
        </TabsContent>

        {/* Scheduled Payouts */}
        <TabsContent value="scheduled" className="mt-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md space-y-4">
            <div className="space-y-2">
              <Label>Payout Interval</Label>
              <Select value={scheduleInterval} onValueChange={setScheduleInterval}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Minimum Payout Amount (TSh)</Label>
              <Input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
            <Button onClick={handleSaveSchedule} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Settings
            </Button>
          </div>
        </TabsContent>

        {/* Batches */}
        <TabsContent value="batches" className="mt-4">
          {loadingBatches ? (
            <LoadingState message="Loading batches..." />
          ) : batches.length === 0 ? (
            <EmptyState title="No batches" description="No payout batches found." />
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell>{b.date || '—'}</TableCell>
                      <TableCell>{b.count}</TableCell>
                      <TableCell className="font-medium">TSh{Number(b.total || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'completed' ? 'default' : 'secondary'}>{b.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
