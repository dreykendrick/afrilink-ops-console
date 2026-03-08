import { useState, useCallback } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { RefreshCw, Search, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface WalletRecord {
  userId: string;
  userName: string;
  userRole: string;
  balance: number;
  pendingWithdrawals: number;
  totalEarned: number;
  totalWithdrawn: number;
}

export default function CheckoutWalletsPage() {
  const { callApi } = useCheckoutApi();
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    const params: Record<string, string> = {};
    if (roleFilter !== 'all') params.role = roleFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    const { data } = await callApi<WalletRecord[] | { wallets: WalletRecord[] }>({
      path: '/admin/wallets',
      queryParams: params,
      showErrorToast: false,
    });

    const list = Array.isArray(data) ? data : (data as any)?.wallets ?? [];
    setWallets(list);
    setLoading(false);
  }, [callApi, roleFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet Balances</h1>
          <p className="text-muted-foreground">View vendor and affiliate wallet balances</p>
        </div>
        <Button onClick={fetchWallets} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-64"
            onKeyDown={(e) => e.key === 'Enter' && fetchWallets()}
          />
          <Button variant="outline" size="icon" onClick={fetchWallets}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading wallets..." />
      ) : !searched ? (
        <EmptyState icon={Wallet} title="Search for wallets" description="Use the filters above and click Refresh to load wallet balances." />
      ) : wallets.length === 0 ? (
        <EmptyState icon={Wallet} title="No wallets found" description="No wallet records matched your search criteria." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Pending Withdrawals</TableHead>
                <TableHead>Total Earned</TableHead>
                <TableHead>Total Withdrawn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((w) => (
                <TableRow key={w.userId}>
                  <TableCell className="font-medium text-foreground">{w.userName || w.userId}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{w.userRole}</TableCell>
                  <TableCell className="font-medium text-foreground">{formatCurrency(w.balance)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(w.pendingWithdrawals)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(w.totalEarned)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(w.totalWithdrawn)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
