import { useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import { Search, Store, RefreshCw, CheckCircle, XCircle, UserX, UserCheck, Eye } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Vendor } from '@/lib/types';

export default function VendorsPage() {
  const { createAuditLog } = useAuditLog();
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'suspend' | 'unsuspend' | null>(null);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      // External AfriLink database uses 'vendor_profiles' table with different column names
      const { data, error } = await externalSupabase
        .from('vendor_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map external schema to expected Vendor format
      // Note: vendor_profiles only has verification_status, we derive account_status from it
      const mappedVendors = (data || []).map((v: Record<string, unknown>) => {
        const verificationStatus = (v.verification_status || 'pending') as string;
        // Derive account_status from verification_status since the external DB doesn't have account_status
        let accountStatus: 'pending' | 'active' | 'suspended' = 'pending';
        if (verificationStatus === 'verified' || verificationStatus === 'approved') {
          accountStatus = 'active';
        } else if (verificationStatus === 'rejected' || verificationStatus === 'suspended') {
          accountStatus = 'suspended';
        }
        
        return {
          id: v.id as string,
          user_id: v.user_id as string || '',
          business_name: (v.business_name || v.name || v.shop_name || v.store_name || 'Unknown Vendor') as string,
          city: v.city as string || v.location as string || null,
          phone: v.phone as string || v.phone_number as string || null,
          verification_status: verificationStatus as 'pending' | 'verified' | 'rejected',
          account_status: accountStatus,
          total_orders: v.total_orders as number || 0,
          total_revenue: v.total_revenue as number || 0,
          created_at: v.created_at as string || '',
          updated_at: v.updated_at as string || '',
        };
      }) as Vendor[];
      
      setVendors(mappedVendors);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      !searchQuery ||
      vendor.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.city?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || vendor.account_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAction = async (reason?: string) => {
    if (!selectedVendor || !actionType) return;
    
    setIsActionLoading(true);
    try {
      const beforeData = { 
        account_status: selectedVendor.account_status, 
        verification_status: selectedVendor.verification_status 
      };
      let updateData: Record<string, string> = {};
      let auditAction = '';

      // The external database only has verification_status column
      // We update verification_status to reflect the desired state
      switch (actionType) {
        case 'approve':
          updateData = { verification_status: 'verified' };
          auditAction = 'VENDOR_APPROVED';
          break;
        case 'reject':
          updateData = { verification_status: 'rejected' };
          auditAction = 'VENDOR_REJECTED';
          break;
        case 'suspend':
          updateData = { verification_status: 'suspended' };
          auditAction = 'VENDOR_SUSPENDED';
          break;
        case 'unsuspend':
          updateData = { verification_status: 'verified' };
          auditAction = 'VENDOR_UNSUSPENDED';
          break;
      }

      const { error } = await externalSupabase
        .from('vendor_profiles')
        .update(updateData)
        .eq('id', selectedVendor.id);

      if (error) throw error;

      await createAuditLog({
        actionType: auditAction,
        entityType: 'vendor',
        entityId: selectedVendor.id,
        beforeData,
        afterData: updateData,
        reason,
      });

      toast.success(`Vendor ${actionType}${actionType.endsWith('e') ? 'd' : 'ed'} successfully`);
      fetchVendors();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
      setSelectedVendor(null);
      setActionType(null);
    }
  };

  const getActionDialogContent = () => {
    switch (actionType) {
      case 'approve':
        return {
          title: 'Approve Vendor',
          description: `Approve ${selectedVendor?.business_name}? They will be able to list products and receive orders.`,
          confirmLabel: 'Approve Vendor',
          variant: 'default' as const,
          requireReason: false,
        };
      case 'reject':
        return {
          title: 'Reject Vendor',
          description: `Reject ${selectedVendor?.business_name}? Please provide a reason.`,
          confirmLabel: 'Reject Vendor',
          variant: 'destructive' as const,
          requireReason: true,
        };
      case 'suspend':
        return {
          title: 'Suspend Vendor',
          description: `Suspend ${selectedVendor?.business_name}? Their products will be hidden and they won't receive new orders.`,
          confirmLabel: 'Suspend Vendor',
          variant: 'destructive' as const,
          requireReason: true,
        };
      case 'unsuspend':
        return {
          title: 'Activate Vendor',
          description: `Activate ${selectedVendor?.business_name}? Their products will be visible again.`,
          confirmLabel: 'Activate Vendor',
          variant: 'default' as const,
          requireReason: false,
        };
      default:
        return { title: '', description: '', confirmLabel: '', variant: 'default' as const, requireReason: false };
    }
  };

  const dialogContent = getActionDialogContent();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="text-muted-foreground">Manage vendor accounts and approvals</p>
        </div>
        <Button onClick={fetchVendors} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by business name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-input border-border"
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

      {/* Vendors Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : filteredVendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No vendors found"
          description={searchQuery || statusFilter !== 'all' 
            ? "Try adjusting your filters" 
            : "Vendors will appear here once they register"}
        />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Business</th>
                  <th>City</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <p className="font-medium text-foreground">{vendor.business_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Joined {formatRelativeDate(vendor.created_at)}
                      </p>
                    </td>
                    <td className="text-muted-foreground">{vendor.city || '---'}</td>
                    <td>
                      <StatusChip status={vendor.verification_status} />
                    </td>
                    <td>
                      <StatusChip status={vendor.account_status} />
                    </td>
                    <td className="text-foreground">{vendor.total_orders}</td>
                    <td className="text-foreground font-medium">
                      {formatCurrency(vendor.total_revenue)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewVendor(vendor)}
                          className="action-btn-secondary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {vendor.account_status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedVendor(vendor);
                                setActionType('approve');
                              }}
                              className="action-btn-primary"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedVendor(vendor);
                                setActionType('reject');
                              }}
                              className="action-btn-destructive"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        {vendor.account_status === 'active' && (
                          <button
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setActionType('suspend');
                            }}
                            className="action-btn-destructive"
                          >
                            <UserX className="w-4 h-4" />
                            Suspend
                          </button>
                        )}
                        
                        {vendor.account_status === 'suspended' && (
                          <button
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setActionType('unsuspend');
                            }}
                            className="action-btn-primary"
                          >
                            <UserCheck className="w-4 h-4" />
                            Activate
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

      {/* Vendor Detail Dialog */}
      <Dialog open={!!viewVendor} onOpenChange={(open) => !open && setViewVendor(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Vendor Details</DialogTitle>
          </DialogHeader>
          {viewVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Business Name</p>
                  <p className="font-medium text-foreground">{viewVendor.business_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">City</p>
                  <p className="font-medium text-foreground">{viewVendor.city || '---'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{viewVendor.phone || '---'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusChip status={viewVendor.account_status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="font-medium text-foreground">{viewVendor.total_orders}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="font-medium text-foreground">{formatCurrency(viewVendor.total_revenue)}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">Joined</p>
                <p className="font-medium text-foreground">{formatRelativeDate(viewVendor.created_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!selectedVendor && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedVendor(null);
            setActionType(null);
          }
        }}
        title={dialogContent.title}
        description={dialogContent.description}
        confirmLabel={dialogContent.confirmLabel}
        variant={dialogContent.variant}
        requireReason={dialogContent.requireReason}
        reasonLabel="Reason"
        onConfirm={handleAction}
        isLoading={isActionLoading}
      />
    </div>
  );
}
