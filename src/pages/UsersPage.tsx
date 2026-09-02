import { useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { maskPhone, formatRelativeDate } from '@/lib/utils';
import { Search, Users, UserX, UserCheck, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { User } from '@/lib/types';

type UserRow = User & {
  profile_id?: string | null;
  auth_user_id?: string | null;
};

const normalizeRole = (role: unknown): 'buyer' | 'vendor' | 'affiliate' => {
  const roleName = String(role || 'buyer').toLowerCase();
  if (roleName === 'customer' || roleName === 'buyer') return 'buyer';
  if (roleName === 'vendor') return 'vendor';
  if (roleName === 'affiliate') return 'affiliate';
  return 'buyer';
};

const normalizeStatus = (status: unknown): 'active' | 'suspended' => {
  return String(status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ? 'suspended' : 'active';
};

export default function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const { createAuditLog } = useAuditLog();
  
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'reset_verification' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      const { data: rolesData, error: rolesError } = await externalSupabase
        .from('user_roles')
        .select('*, profile:profiles!user_roles_profile_id_fkey(*), role_info:roles(name)')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      const mappedUsers = (rolesData || []).map((u: Record<string, unknown>) => {
        const profile = ((u as any).profile || {}) as Record<string, unknown>;
        const authUserId = (profile.auth_user_id || u.user_id || u.profile_id || profile.id) as string | null;
        const roleName = (u as any).role_info?.name || u.role || u.user_role || 'buyer';
        const phoneVerified = Boolean(profile.phone_verified || profile.verification_status === 'verified');
        
        return {
          id: u.id as string,
          profile_id: (u.profile_id || profile.id || null) as string | null,
          auth_user_id: authUserId,
          user_id: authUserId || '',
          phone: (profile.phone || profile.phone_number || u.phone || u.phone_number || null) as string | null,
          email: (profile.email || profile.email_address || u.email || u.email_address || null) as string | null,
          full_name: (profile.full_name || profile.name || profile.display_name || u.full_name || u.name || null) as string | null,
          role: normalizeRole(roleName),
          verification_status: (profile.verification_status || u.verification_status || (phoneVerified ? 'verified' : 'unverified')) as string,
          account_status: normalizeStatus(profile.account_status || profile.status || u.account_status),
          city: (profile.city || profile.location || u.city || null) as string | null,
          created_at: (profile.created_at || u.created_at || '') as string,
          updated_at: (profile.updated_at || u.updated_at || '') as string,
          last_active_at: (profile.last_active_at || profile.last_login || u.last_active_at || null) as string | null,
        };
      }) as UserRow[];
      
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.account_status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAction = async (reason?: string) => {
    if (!selectedUser || !actionType) return;
    
    setIsActionLoading(true);
    try {
      const beforeData = {
        account_status: selectedUser.account_status,
        verification_status: selectedUser.verification_status,
      };
      let updateData: Record<string, unknown> = {};
      let auditAction = '';

      switch (actionType) {
        case 'suspend':
          updateData = { account_status: 'SUSPENDED' };
          auditAction = 'USER_SUSPENDED';
          break;
        case 'unsuspend':
          updateData = { account_status: 'ACTIVE' };
          auditAction = 'USER_UNSUSPENDED';
          break;
        case 'reset_verification':
          updateData = { phone_verified: false };
          auditAction = 'USER_VERIFICATION_RESET';
          break;
      }

      const targetProfileId = selectedUser.profile_id;
      const targetAuthUserId = selectedUser.auth_user_id || selectedUser.user_id;

      if (!targetProfileId && !targetAuthUserId) {
        throw new Error('Selected user is missing a profile identifier');
      }

      let query = externalSupabase.from('profiles').update(updateData);
      const { error } = targetProfileId
        ? await query.eq('id', targetProfileId)
        : await query.eq('auth_user_id', targetAuthUserId);

      if (error) throw error;

      await createAuditLog({
        actionType: auditAction,
        entityType: 'user',
        entityId: targetAuthUserId || targetProfileId || selectedUser.id,
        beforeData,
        afterData: updateData,
        reason,
      });

      toast.success(`User ${actionType === 'suspend' ? 'suspended' : actionType === 'unsuspend' ? 'activated' : 'verification reset'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
      setSelectedUser(null);
      setActionType(null);
    }
  };

  const getActionDialogContent = () => {
    switch (actionType) {
      case 'suspend':
        return {
          title: 'Suspend User',
          description: `Are you sure you want to suspend ${selectedUser?.full_name || selectedUser?.email || 'this user'}? They will lose access to the platform.`,
          confirmLabel: 'Suspend User',
          variant: 'destructive' as const,
        };
      case 'unsuspend':
        return {
          title: 'Activate User',
          description: `Are you sure you want to activate ${selectedUser?.full_name || selectedUser?.email || 'this user'}? They will regain access to the platform.`,
          confirmLabel: 'Activate User',
          variant: 'default' as const,
        };
      case 'reset_verification':
        return {
          title: 'Reset Verification',
          description: `This will reset the verification status for ${selectedUser?.full_name || selectedUser?.email || 'this user'}. They will need to verify again.`,
          confirmLabel: 'Reset Verification',
          variant: 'default' as const,
        };
      default:
        return { title: '', description: '', confirmLabel: '', variant: 'default' as const };
    }
  };

  const dialogContent = getActionDialogContent();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-muted-foreground">Manage buyers, vendors, and affiliates</p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px] bg-input border-border">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="buyer">Buyer</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-input border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description={searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
            ? 'Try adjusting your filters'
            : 'Users will appear here once they sign up'}
        />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.profile_id || user.auth_user_id || user.id}>
                    <td>
                      <div>
                        <p className="font-medium text-foreground">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                      </div>
                    </td>
                    <td className="phone-masked text-muted-foreground">{maskPhone(user.phone)}</td>
                    <td><span className="capitalize text-foreground">{user.role}</span></td>
                    <td><StatusChip status={user.verification_status} /></td>
                    <td><StatusChip status={user.account_status} /></td>
                    <td className="text-muted-foreground">{formatRelativeDate(user.created_at)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {user.account_status === 'active' ? (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setActionType('suspend');
                            }}
                            className="action-btn-destructive"
                          >
                            <UserX className="w-4 h-4" />
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setActionType('unsuspend');
                            }}
                            className="action-btn-primary"
                          >
                            <UserCheck className="w-4 h-4" />
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setActionType('reset_verification');
                          }}
                          className="action-btn-secondary"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
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
        open={!!selectedUser && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
            setActionType(null);
          }
        }}
        title={dialogContent.title}
        description={dialogContent.description}
        confirmLabel={dialogContent.confirmLabel}
        variant={dialogContent.variant}
        requireReason={actionType === 'suspend'}
        reasonLabel="Reason for suspension"
        onConfirm={handleAction}
        isLoading={isActionLoading}
      />
    </div>
  );
}
