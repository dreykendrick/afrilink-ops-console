import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { LoadingState } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Send,
  Truck,
  CheckCircle,
  XCircle,
  Phone,
  MapPin,
  Package,
  CreditCard,
  User,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Order, Vendor, User as AppUser } from '@/lib/types';

interface OrderDetail extends Order {
  vendors: Vendor | null;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { createAuditLog } = useAuditLog();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [actionType, setActionType] = useState<'resend_notification' | 'mark_out_for_delivery' | 'mark_delivered' | 'force_confirm' | 'cancel' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      
      // Fetch order first
      const { data: orderData, error: orderError } = await externalSupabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      // Fetch vendor separately if order has vendor_id
      let vendor = null;
      if (orderData.vendor_id) {
        // External AfriLink database uses 'vendor_profiles' table
        const { data: vendorData } = await externalSupabase
          .from('vendor_profiles')
          .select('*')
          .eq('id', orderData.vendor_id)
          .single();
        vendor = vendorData;
      }

      setOrder({ ...orderData, vendors: vendor } as OrderDetail);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load order');
      navigate('/orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (reason?: string) => {
    if (!order || !actionType) return;
    
    setIsActionLoading(true);
    try {
      const beforeData = { status: order.status };
      let updateData: Record<string, unknown> = {};
      let auditAction = '';

      switch (actionType) {
        case 'resend_notification':
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
        .eq('id', order.id);

      if (error) throw error;

      await createAuditLog({
        actionType: auditAction,
        entityType: 'order',
        entityId: order.id,
        beforeData,
        afterData: updateData,
        reason,
      });

      toast.success('Order updated successfully');
      fetchOrder();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
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
          description: 'Mark this order as delivered?',
          confirmLabel: 'Mark Delivered',
          variant: 'default' as const,
          requireReason: false,
        };
      case 'force_confirm':
        return {
          title: 'Force Confirm Delivery',
          description: 'Force confirm this delivery? This bypasses buyer confirmation.',
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

  if (isLoading) {
    return <LoadingState message="Loading order..." />;
  }

  if (!order) {
    return null;
  }

  const dialogContent = getActionDialogContent();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orders')}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            Order {order.order_number}
            <StatusChip status={order.status} />
          </h1>
          <p className="text-muted-foreground">Created {formatDate(order.created_at)}</p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {['payment_confirmed', 'vendor_notified'].includes(order.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionType('resend_notification')}
            >
              <Send className="w-4 h-4 mr-2" />
              Resend Notification
            </Button>
          )}
          
          {order.status === 'vendor_notified' && (
            <Button size="sm" onClick={() => setActionType('mark_out_for_delivery')}>
              <Truck className="w-4 h-4 mr-2" />
              Mark Out for Delivery
            </Button>
          )}
          
          {order.status === 'out_for_delivery' && (
            <Button size="sm" onClick={() => setActionType('mark_delivered')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Delivered
            </Button>
          )}
          
          {order.status === 'delivered_pending_confirmation' && isSuperAdmin && (
            <Button size="sm" onClick={() => setActionType('force_confirm')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Force Confirm
            </Button>
          )}
          
          {!['confirmed', 'cancelled'].includes(order.status) && isSuperAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setActionType('cancel')}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Order Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buyer Information */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            Buyer Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{order.buyer_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone
              </p>
              <p className="font-medium text-foreground">{order.buyer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Delivery Address
              </p>
              <p className="font-medium text-foreground">{order.buyer_city}</p>
              {order.buyer_address && (
                <p className="text-foreground">{order.buyer_address}</p>
              )}
              {order.buyer_landmark && (
                <p className="text-muted-foreground">Landmark: {order.buyer_landmark}</p>
              )}
            </div>
          </div>
        </div>

        {/* Vendor Information */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-primary" />
            Vendor Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Business Name</p>
              <p className="font-medium text-foreground">{order.vendors?.business_name || '---'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{order.vendors?.phone || '---'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">City</p>
              <p className="font-medium text-foreground">{order.vendors?.city || '---'}</p>
            </div>
          </div>
        </div>

        {/* Delivery Information */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-primary" />
            Delivery Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Delivery Address</p>
              <p className="font-medium text-foreground">{order.buyer_city}</p>
              {order.buyer_address && <p className="text-foreground">{order.buyer_address}</p>}
              {order.buyer_landmark && <p className="text-muted-foreground">Landmark: {order.buyer_landmark}</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendor Origin</p>
              <p className="font-medium text-foreground">{order.vendors?.city || 'Not available'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Delivery Fee</p>
                <p className="font-medium text-foreground">{formatCurrency(order.delivery_fee)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Distance</p>
                <p className="font-medium text-muted-foreground italic">Not tracked yet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-primary" />
            Product Details
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Product</p>
              <p className="font-medium text-foreground">{order.product_name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="font-medium text-foreground">{order.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unit Price</p>
                <p className="font-medium text-foreground">{formatCurrency(order.unit_price)}</p>
              </div>
            </div>
            {order.affiliate_code && (
              <div>
                <p className="text-sm text-muted-foreground">Affiliate Code</p>
                <p className="font-medium text-primary">{order.affiliate_code}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Information */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            Payment Details
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-foreground">{formatCurrency(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-foreground font-semibold">Total</span>
              <span className="text-primary text-xl font-bold">{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Status</span>
                <StatusChip status={order.payment_status} />
              </div>
              {order.payment_reference && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-mono text-foreground">{order.payment_reference}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline / Notifications */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Order Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <p className="text-foreground">Order Created</p>
              <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
            </div>
          </div>
          
          {order.vendor_notified_at && (
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div>
                <p className="text-foreground">Vendor Notified</p>
                <p className="text-sm text-muted-foreground">{formatDate(order.vendor_notified_at)}</p>
              </div>
            </div>
          )}
          
          {order.delivered_at && (
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <div>
                <p className="text-foreground">Delivered</p>
                <p className="text-sm text-muted-foreground">{formatDate(order.delivered_at)}</p>
              </div>
            </div>
          )}
          
          {order.confirmed_at && (
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <p className="text-foreground">Confirmed</p>
                <p className="text-sm text-muted-foreground">{formatDate(order.confirmed_at)}</p>
              </div>
            </div>
          )}
          
          {order.cancelled_at && (
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div>
                <p className="text-foreground">Cancelled</p>
                <p className="text-sm text-muted-foreground">{formatDate(order.cancelled_at)}</p>
                {order.cancellation_reason && (
                  <p className="text-sm text-destructive mt-1">Reason: {order.cancellation_reason}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!actionType}
        onOpenChange={(open) => !open && setActionType(null)}
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
