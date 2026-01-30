import { cn } from '@/lib/utils';

interface StatusChipProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: string }> = {
  // General
  pending: { label: 'Pending', variant: 'pending' },
  active: { label: 'Active', variant: 'active' },
  suspended: { label: 'Suspended', variant: 'suspended' },
  
  // Product status
  approved: { label: 'Approved', variant: 'approved' },
  rejected: { label: 'Rejected', variant: 'rejected' },
  
  // Order status
  pending_payment: { label: 'Pending Payment', variant: 'pending' },
  payment_confirmed: { label: 'Paid', variant: 'approved' },
  vendor_notified: { label: 'Vendor Notified', variant: 'processing' },
  out_for_delivery: { label: 'Out for Delivery', variant: 'processing' },
  delivered_pending_confirmation: { label: 'Delivered', variant: 'pending' },
  confirmed: { label: 'Confirmed', variant: 'confirmed' },
  disputed: { label: 'Disputed', variant: 'open' },
  cancelled: { label: 'Cancelled', variant: 'cancelled' },
  
  // Notification status
  sent: { label: 'Sent', variant: 'approved' },
  failed: { label: 'Failed', variant: 'failed' },
  
  // Payout status
  processing: { label: 'Processing', variant: 'processing' },
  completed: { label: 'Completed', variant: 'completed' },
  
  // Dispute status
  open: { label: 'Open', variant: 'open' },
  resolved: { label: 'Resolved', variant: 'approved' },
  
  // Verification status
  verified: { label: 'Verified', variant: 'approved' },
  unverified: { label: 'Unverified', variant: 'pending' },
};

const variantStyles: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  active: 'bg-green-500/20 text-green-400',
  confirmed: 'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  suspended: 'bg-red-500/20 text-red-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-red-500/20 text-red-400',
  processing: 'bg-blue-500/20 text-blue-400',
  open: 'bg-orange-500/20 text-orange-400',
};

export function StatusChip({ status, className }: StatusChipProps) {
  const config = statusConfig[status] || { label: status, variant: 'pending' };
  const variantStyle = variantStyles[config.variant] || variantStyles.pending;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyle,
        className
      )}
    >
      {config.label}
    </span>
  );
}
