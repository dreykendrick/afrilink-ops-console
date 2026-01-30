export type AppRole = 'SUPER_ADMIN' | 'OPS_ADMIN';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  admin_user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface User {
  id: string;
  user_id: string | null;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  role: 'buyer' | 'vendor' | 'affiliate';
  verification_status: string;
  account_status: 'active' | 'suspended';
  city: string | null;
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
}

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string;
  city: string | null;
  phone: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  account_status: 'pending' | 'active' | 'suspended';
  total_orders: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[] | null;
  commission_percent: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
}

export type OrderStatus = 
  | 'pending_payment'
  | 'payment_confirmed'
  | 'vendor_notified'
  | 'out_for_delivery'
  | 'delivered_pending_confirmation'
  | 'confirmed'
  | 'disputed'
  | 'cancelled';

export interface Order {
  id: string;
  order_number: string;
  buyer_id: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_city: string;
  buyer_address: string | null;
  buyer_landmark: string | null;
  vendor_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  status: OrderStatus;
  payment_status: string;
  payment_reference: string | null;
  affiliate_code: string | null;
  affiliate_user_id: string | null;
  vendor_notified_at: string | null;
  buyer_receipt_sent_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  buyer?: User;
  affiliate?: User;
}

export interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string | null;
  reason: string;
  buyer_note: string | null;
  status: 'open' | 'resolved';
  resolution_note: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  order?: Order;
  buyer?: User;
}

export interface NotificationLog {
  id: string;
  type: string;
  recipient: string;
  masked_recipient: string;
  status: 'pending' | 'sent' | 'failed';
  provider: string | null;
  provider_response: Record<string, unknown> | null;
  related_order_id: string | null;
  retry_count: number;
  created_at: string;
  sent_at: string | null;
}

export interface Payout {
  id: string;
  payout_reference: string;
  recipient_type: 'vendor' | 'affiliate';
  recipient_id: string;
  recipient_name: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  failure_reason: string | null;
  processed_by: string | null;
  reference_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface SameCityZone {
  id: string;
  city: string;
  zone_name: string;
  fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrossCityFee {
  id: string;
  from_city: string;
  to_city: string;
  fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  ordersToday: number;
  ordersThisWeek: number;
  gmvToday: number;
  gmvThisWeek: number;
  pendingProductReviews: number;
  failedNotifications: number;
  pendingDisputes: number;
  pendingPayouts: number;
}
