import { useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeDate } from '@/lib/utils';
import { UserCheck, RefreshCw, CheckCircle, XCircle, Search, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Affiliate {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  affiliate_code: string | null;
  account_status: string;
  verification_status: string;
  created_at: string;
  total_referrals?: number;
  total_earnings?: number;
}

export default function AffiliatesPage() {
  const { isSuperAdmin, adminUser } = useAuth();
  const { createAuditLog } = useAuditLog();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'suspend' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => { fetchAffiliates(); }, []);

  const fetchAffiliates = async () => {
    setIsLoading(true);
    
    // Try different possible table names for affiliates
    let data: Record<string, unknown>[] | null = null;
    let error: Error | null = null;
    
    // First try 'affiliates' table
    const affiliatesRes = await externalSupabase.from('affiliates').select('*').order('created_at', { ascending: false });
    if (!affiliatesRes.error) {
      data = affiliatesRes.data;
    } else {
      // Try 'user_roles' with affiliate filter
      const userRolesRes = await externalSupabase.from('user_roles').select('*').eq('role', 'affiliate').order('created_at', { ascending: false });
      if (!userRolesRes.error) {
        data = userRolesRes.data;
      } else {
        // Try 'users' with affiliate role
        const usersRes = await externalSupabase.from('users').select('*').eq('role', 'affiliate').order('created_at', { ascending: false });
        if (!usersRes.error) {
          data = usersRes.data;
        } else {
          error = usersRes.error as Error;
        }
      }
    }

    if (error) {
      console.error('Error fetching affiliates:', error);
      setAffiliates([]);
    } else {
      // Map to expected format with resilient field mapping
      const mapped = (data || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        user_id: (d.user_id || d.auth_user_id) as string | null,
        full_name: (d.full_name || d.name || d.display_name) as string | null,
        email: d.email as string | null,
        phone: d.phone as string | null,
        affiliate_code: (d.affiliate_code || d.referral_code || d.code) as string | null,
        account_status: (d.account_status || d.status || 'pending') as string,
        verification_status: (d.verification_status || 'pending') as string,
        created_at: d.created_at as string,
        total_referrals: (d.total_referrals || d.referral_count || 0) as number,
        total_earnings: (d.total_earnings || d.earnings || 0) as number,
      }));
      setAffiliates(mapped);
    }
    setIsLoading(false);
  };

  const handleAction = async (reason?: string) => {
    if (!selectedAffiliate || !actionType || !adminUser) return;
    setIsActionLoading(true);

    const newStatus = actionType === 'approve' ? 'active' : 'suspended';
    const beforeData = { account_status: selectedAffiliate.account_status };

    // Try updating in affiliates table first, then user_roles, then users
    let updateError: Error | null = null;
    
    const { error: affiliatesError } = await externalSupabase
      .from('affiliates')
      .update({ account_status: newStatus, verification_status: actionType === 'approve' ? 'verified' : selectedAffiliate.verification_status })
      .eq('id', selectedAffiliate.id);
    
    if (affiliatesError) {
      const { error: userRolesError } = await externalSupabase
        .from('user_roles')
        .update({ account_status: newStatus })
        .eq('id', selectedAffiliate.id);
      
      if (userRolesError) {
        const { error: usersError } = await externalSupabase
          .from('users')
          .update({ account_status: newStatus })
          .eq('id', selectedAffiliate.id);
        
        updateError = usersError as Error | null;
      }
    }

    if (updateError) {
      toast.error(`Failed to ${actionType} affiliate`);
    } else {
      await createAuditLog({
        actionType: actionType === 'approve' ? 'AFFILIATE_APPROVED' : 'AFFILIATE_SUSPENDED',
        entityType: 'affiliate',
        entityId: selectedAffiliate.id,
        beforeData,
        afterData: { account_status: newStatus },
        reason,
      });
      toast.success(`Affiliate ${actionType === 'approve' ? 'approved' : 'suspended'} successfully`);
      fetchAffiliates();
    }

    setIsActionLoading(false);
    setSelectedAffiliate(null);
    setActionType(null);
  };

  const filtered = affiliates.filter((a) => {
    const matchesStatus = statusFilter === 'all' || a.account_status === statusFilter;
    const matchesSearch = !searchQuery || 
      a.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.phone?.includes(searchQuery) ||
      a.affiliate_code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = affiliates.filter(a => a.account_status === 'pending').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Affiliates</h1>
          <p className="text-muted-foreground">
            Manage affiliate accounts and approvals
            {pendingCount > 0 && <span className="ml-2 text-primary font-medium">({pendingCount} pending)</span>}
          </p>
        </div>
        <Button onClick={fetchAffiliates} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      <div className="filter-bar flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-input border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-input border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton rows={6} cols={7} /> : filtered.length === 0 ? (
        <EmptyState 
          icon={Users} 
          title="No affiliates found" 
          description={affiliates.length === 0 ? "Affiliates will appear here when users sign up as affiliates" : "No affiliates match your current filters"} 
        />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Affiliate Code</th>
                  <th>Status</th>
                  <th>Referrals</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((affiliate) => (
                  <tr key={affiliate.id}>
                    <td className="text-foreground font-medium">
                      {affiliate.full_name || '---'}
                    </td>
                    <td>
                      <div className="text-sm">
                        <div className="text-muted-foreground">{affiliate.email || '---'}</div>
                        <div className="text-muted-foreground">{affiliate.phone || '---'}</div>
                      </div>
                    </td>
                    <td>
                      <code className="bg-secondary px-2 py-1 rounded text-sm text-foreground">
                        {affiliate.affiliate_code || '---'}
                      </code>
                    </td>
                    <td>
                      <StatusChip status={affiliate.account_status} />
                    </td>
                    <td className="text-muted-foreground">
                      {affiliate.total_referrals || 0}
                    </td>
                    <td className="text-muted-foreground">
                      {formatRelativeDate(affiliate.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {affiliate.account_status === 'pending' && (
                          <button
                            onClick={() => { setSelectedAffiliate(affiliate); setActionType('approve'); }}
                            className="action-btn-primary"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                        )}
                        {affiliate.account_status === 'active' && isSuperAdmin && (
                          <button
                            onClick={() => { setSelectedAffiliate(affiliate); setActionType('suspend'); }}
                            className="action-btn-danger"
                          >
                            <XCircle className="w-4 h-4" />
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!selectedAffiliate && !!actionType}
        onOpenChange={(o) => { if (!o) { setSelectedAffiliate(null); setActionType(null); } }}
        title={actionType === 'approve' ? 'Approve Affiliate' : 'Suspend Affiliate'}
        description={
          actionType === 'approve'
            ? `Are you sure you want to approve ${selectedAffiliate?.full_name || 'this affiliate'}? They will be able to start referring customers.`
            : `Are you sure you want to suspend ${selectedAffiliate?.full_name || 'this affiliate'}? They will no longer be able to earn commissions.`
        }
        confirmLabel={actionType === 'approve' ? 'Approve' : 'Suspend'}
        variant={actionType === 'approve' ? 'default' : 'destructive'}
        requireReason={actionType === 'suspend'}
        reasonLabel="Reason for suspension"
        onConfirm={handleAction}
        isLoading={isActionLoading}
      />
    </div>
  );
}
