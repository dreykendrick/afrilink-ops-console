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
    
    // The external database has 'user_roles' table with affiliate role
    // and 'affiliate_links' for referral codes
    // We need to join user data from user_roles
    let affiliateData: Affiliate[] = [];
    
    // Fetch from user_roles where role is affiliate
    const { data: roleData, error: roleError } = await externalSupabase
      .from('user_roles')
      .select('*')
      .eq('role', 'affiliate')
      .order('created_at', { ascending: false });
    
    if (roleError) {
      console.error('Error fetching affiliates:', roleError);
      setAffiliates([]);
      setIsLoading(false);
      return;
    }

    // Get user details for each affiliate from user_profiles or profiles table
    const userIds = (roleData || []).map((r: Record<string, unknown>) => r.user_id);
    
    let userProfiles: Record<string, unknown>[] = [];
    if (userIds.length > 0) {
      // Try user_profiles table first
      const { data: profilesData, error: profilesError } = await externalSupabase
        .from('user_profiles')
        .select('*')
        .in('user_id', userIds);
      
      if (!profilesError && profilesData) {
        userProfiles = profilesData;
      } else {
        // Try profiles table
        const { data: altProfiles } = await externalSupabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        
        if (altProfiles) {
          userProfiles = altProfiles;
        }
      }
    }

    // Get affiliate links for referral codes
    let affiliateLinks: Record<string, unknown>[] = [];
    if (userIds.length > 0) {
      const { data: linksData } = await externalSupabase
        .from('affiliate_links')
        .select('*')
        .in('user_id', userIds);
      
      if (linksData) {
        affiliateLinks = linksData;
      }
    }

    // Map and merge the data
    affiliateData = (roleData || []).map((r: Record<string, unknown>) => {
      const userId = r.user_id as string;
      const profile = userProfiles.find((p: Record<string, unknown>) => 
        (p.user_id || p.id) === userId
      ) || {};
      const link = affiliateLinks.find((l: Record<string, unknown>) => 
        l.user_id === userId
      ) || {};
      
      // Derive status from the link's status or default to 'pending'
      const status = (link.status || link.is_active === true ? 'active' : link.is_active === false ? 'suspended' : 'pending') as string;
      
      return {
        id: r.id as string,
        user_id: userId,
        full_name: (profile.full_name || profile.name || profile.display_name) as string | null,
        email: profile.email as string | null,
        phone: profile.phone as string | null,
        affiliate_code: (link.code || link.referral_code || link.affiliate_code) as string | null,
        account_status: status,
        verification_status: status === 'active' ? 'verified' : 'pending',
        created_at: r.created_at as string,
        total_referrals: (link.total_referrals || link.referral_count || 0) as number,
        total_earnings: (link.total_earnings || link.earnings || 0) as number,
      };
    });

    setAffiliates(affiliateData);
    setIsLoading(false);
  };

  const handleAction = async (reason?: string) => {
    if (!selectedAffiliate || !actionType || !adminUser) return;
    setIsActionLoading(true);

    const newStatus = actionType === 'approve' ? 'active' : 'inactive';
    const beforeData = { status: selectedAffiliate.account_status };

    // Update the affiliate_links table status
    const { error: linkError } = await externalSupabase
      .from('affiliate_links')
      .update({ 
        status: newStatus,
        is_active: actionType === 'approve'
      })
      .eq('user_id', selectedAffiliate.user_id);

    if (linkError) {
      // If affiliate_links doesn't have these columns or doesn't exist for this user,
      // we still log the action but show a warning
      console.warn('Could not update affiliate_links:', linkError);
      toast.warning(`Affiliate status may require manual update on external system`);
    } else {
      toast.success(`Affiliate ${actionType === 'approve' ? 'approved' : 'suspended'} successfully`);
    }

    // Log the audit action regardless
    await createAuditLog({
      actionType: actionType === 'approve' ? 'AFFILIATE_APPROVED' : 'AFFILIATE_SUSPENDED',
      entityType: 'affiliate',
      entityId: selectedAffiliate.id,
      beforeData,
      afterData: { status: newStatus },
      reason,
    });
    
    fetchAffiliates();

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
