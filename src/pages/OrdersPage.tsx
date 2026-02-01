import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton, LoadingState } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeDate, formatDate, maskPhone } from '@/lib/utils';
import {
  Search,
  ShoppingCart,
  RefreshCw,
  Eye,
  Send,
  Truck,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Order, Vendor } from '@/lib/types';

interface OrderWithVendor extends Order {
  vendors: Vendor | null;
}

const ORDER_STATUSES = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'payment_confirmed', label: 'Payment Confirmed' },
  { value: 'vendor_notified', label: 'Vendor Notified' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered_pending_confirmation', label: 'Delivered' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { createAuditLog } = useAuditLog();
  
  const [orders, setOrders] = useState<OrderWithVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [selectedOrder, setSelectedOrder] = useState<OrderWithVendor | null>(null);
  const [actionType, setActionType] = useState<'resend_notification' | 'mark_out_for_delivery' | 'mark_delivered' | 'force_confirm' | 'cancel' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      // Fetch orders first
      const { data: ordersData, error: ordersError } = await externalSupabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch vendors separately and map them
      const vendorIds = [...new Set((ordersData || []).map(o => o.vendor_id).filter(Boolean))];
      let vendorsMap: Record<string, Vendor> = {};
      
      if (vendorIds.length > 0) {
        // External AfriLink database uses 'vendor_profiles' table
        const { data: vendorsData } = await externalSupabase
          .from('vendor_profiles')
          .select('*')
          .in('id', vendorIds);
        
        vendorsMap = (vendorsData || []).reduce((acc, v) => {
          acc[v.id] = v as Vendor;
          return acc;
        }, {} as Record<string, Vendor>);
      }

      // Combine orders with vendors
      const ordersWithVendors = (ordersData || []).map(o => ({
        ...o,
        vendors: vendorsMap[o.vendor_id] || null,
      })) as OrderWithVendor[];

      setOrders(ordersWithVendors);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAction = async (reason?: string) => {
    if (!selectedOrder || !actionType) return;
    
    setIsActionLoading(true);
    try {
      const beforeData = { status: selectedOrder.status };
      let updateData: Record<string, unknown> = {};
      let auditAction = '';

      switch (actionType) {
        case 'resend_notification':
          // In a real implementation, this would trigger notification resend
          updateData = { vendor_notified_at: new Date().toISOString() };
          auditAction = 'ORDER_NOTIFICATION_RESENT';
          break;
        case 'mark_out_for_delivery':
          updateData = { status: 'out_for_delivery' };
          auditAction = 'ORDER_OUT_FOR_DELIVERY';
          break;
        case 'mark_delivered':
          updateData = { status: 'delivered_pending_confirmation', delivered_at: new Date().toISOString() };
          auditAction = 'ORDER_DELIVERED';
          break;
        case 'force_confirm':
          updateData = { status: 'confirmed', confirmed_at: new Date().toISOString() };
          auditAction = 'ORDER_FORCE_CONFIRMED';
          break;
        case 'cancel':
          updateData = { 
            status: 'cancelled', 
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason,
          };
          auditAction = 'ORDER_CANCELLED';
          break;
      }

      const { error } = await externalSupabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.id);

      if (error) throw error;

      await createAuditLog({
        actionType: auditAction,
        entityType: 'order',
        entityId: selectedOrder.id,
        beforeData,
        afterData: updateData,
        reason,
      });

      toast.success('Order updated successfully');
      fetchOrders();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
      setSelectedOrder(null);
      setActionType(null);
    }
  };

  const getActionDialogContent = () => {
    switch (actionType) {
      case 'resend_notification':
        return {
          title: 'Resend Vendor Notification',
          description: 'This will resend the order notification to the vendor.',
          confirmLabel: 'Resend',
          variant: 'default' as const,
          requireReason: false,
        };
      case 'mark_out_for_delivery':
        return {
          title: 'Mark Out for Delivery',
          description: 'Confirm this order is out for delivery?',
          confirmLabel: 'Confirm',
          variant: 'default' as const,
          requireReason: false,
        };
      case 'mark_delivered':
        return {
          title: 'Mark as Delivered',
          description: 'Mark this order as delivered? The buyer will be asked to confirm.',
          confirmLabel: 'Mark Delivered',
          variant: 'default' as const,
          requireReason: false,
        };
      case 'force_confirm':
        return {
          title: 'Force Confirm Delivery',
          description: 'Force confirm this delivery? This bypasses buyer confirmation. SUPER_ADMIN only.',
          confirmLabel: 'Force Confirm',
          variant: 'default' as const,
          requireReason: true,
        };
      case 'cancel':
        return {
          title: 'Cancel Order',
          description: 'Cancel this order? This action cannot be undone.',
          confirmLabel: 'Cancel Order',
          variant: 'destructive' as const,
          requireReason: true,
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
          <h1 className="page-title">Orders</h1>
          <p className="text-muted-foreground">Manage orders and fulfillment</p>
        </div>
        <Button onClick={fetchOrders} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order #, buyer, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-input border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {ORDER_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          description={searchQuery || statusFilter !== 'all' 
            ? "Try adjusting your filters" 
            : "Orders will appear here once customers place them"}
        />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Order #</th>
                  <th>Buyer</th>
                  <th>Product</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <p className="font-mono font-medium text-primary">{order.order_number}</p>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium text-foreground">{order.buyer_name}</p>
                        <p className="text-sm text-muted-foreground phone-masked">
                          {maskPhone(order.buyer_phone)}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="text-foreground">{order.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {order.quantity} • {order.vendors?.business_name || '---'}
                        </p>
                      </div>
                    </td>
                    <td className="text-foreground font-medium">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td>
                      <StatusChip status={order.status} />
                    </td>
                    <td className="text-muted-foreground">
                      {formatRelativeDate(order.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="action-btn-secondary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {['payment_confirmed', 'vendor_notified'].includes(order.status) && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setActionType('resend_notification');
                            }}
                            className="action-btn-secondary"
                            title="Resend vendor notification"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        
                        {order.status === 'vendor_notified' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setActionType('mark_out_for_delivery');
                            }}
                            className="action-btn-primary"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                        
                        {order.status === 'out_for_delivery' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setActionType('mark_delivered');
                            }}
                            className="action-btn-primary"
                          >
                            <CheckCircle className="w-4 h-4" />
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!selectedOrder && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
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
