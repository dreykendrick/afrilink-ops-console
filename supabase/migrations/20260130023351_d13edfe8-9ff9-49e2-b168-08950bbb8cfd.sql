-- Create app_role enum for admin roles
CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'OPS_ADMIN');

-- Create admin_users table for storing admin profiles
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'OPS_ADMIN',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table for tracking all admin actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications_log table for SMS/WhatsApp tracking
CREATE TABLE public.notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  masked_recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_response JSONB,
  related_order_id UUID,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create same_city_zones table for delivery pricing
CREATE TABLE public.same_city_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city, zone_name)
);

-- Create cross_city_fees table for inter-city delivery pricing
CREATE TABLE public.cross_city_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_city, to_city)
);

-- Create users table for all app users (vendors, affiliates, buyers)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'buyer',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  account_status TEXT NOT NULL DEFAULT 'active',
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active_at TIMESTAMP WITH TIME ZONE
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  city TEXT,
  phone TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  account_status TEXT NOT NULL DEFAULT 'pending',
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  images TEXT[],
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  buyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_city TEXT NOT NULL,
  buyer_address TEXT,
  buyer_landmark TEXT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT,
  affiliate_code TEXT,
  affiliate_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  vendor_notified_at TIMESTAMP WITH TIME ZONE,
  buyer_receipt_sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create disputes table
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  buyer_note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  resolved_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create internal_notes table for admin notes on disputes
CREATE TABLE public.internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payouts table for vendor and affiliate payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_reference TEXT NOT NULL UNIQUE,
  recipient_type TEXT NOT NULL,
  recipient_id UUID NOT NULL,
  recipient_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  processed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reference_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create system_settings table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('auto_confirm_days', '7', 'Number of days before auto-confirm delivery'),
  ('platform_commission_percent', '10', 'Default platform commission percentage');

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Create function to check if user is any admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- Create function to get admin role
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.admin_users
  WHERE user_id = _user_id
    AND is_active = true
  LIMIT 1
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_same_city_zones_updated_at BEFORE UPDATE ON public.same_city_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cross_city_fees_updated_at BEFORE UPDATE ON public.cross_city_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.same_city_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_city_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users (only admins can see/modify)
CREATE POLICY "Admins can view admin_users"
  ON public.admin_users FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can insert admin_users"
  ON public.admin_users FOR INSERT
  WITH CHECK (public.has_admin_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Super admins can update admin_users"
  ON public.admin_users FOR UPDATE
  USING (public.has_admin_role(auth.uid(), 'SUPER_ADMIN'));

-- RLS Policies for audit_logs (admins can view and insert)
CREATE POLICY "Admins can view audit_logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for notifications_log
CREATE POLICY "Admins can view notifications_log"
  ON public.notifications_log FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert notifications_log"
  ON public.notifications_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update notifications_log"
  ON public.notifications_log FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for delivery pricing (admins can CRUD)
CREATE POLICY "Admins can view same_city_zones"
  ON public.same_city_zones FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert same_city_zones"
  ON public.same_city_zones FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update same_city_zones"
  ON public.same_city_zones FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete same_city_zones"
  ON public.same_city_zones FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view cross_city_fees"
  ON public.cross_city_fees FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert cross_city_fees"
  ON public.cross_city_fees FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update cross_city_fees"
  ON public.cross_city_fees FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete cross_city_fees"
  ON public.cross_city_fees FOR DELETE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for users table (admins can view and update)
CREATE POLICY "Admins can view users"
  ON public.users FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for vendors table
CREATE POLICY "Admins can view vendors"
  ON public.vendors FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update vendors"
  ON public.vendors FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for products table
CREATE POLICY "Admins can view products"
  ON public.products FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for orders table
CREATE POLICY "Admins can view orders"
  ON public.orders FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS Policies for disputes table
CREATE POLICY "Admins can view disputes"
  ON public.disputes FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update disputes"
  ON public.disputes FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for internal_notes
CREATE POLICY "Admins can view internal_notes"
  ON public.internal_notes FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert internal_notes"
  ON public.internal_notes FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for payouts
CREATE POLICY "Admins can view payouts"
  ON public.payouts FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can insert payouts"
  ON public.payouts FOR INSERT
  WITH CHECK (public.has_admin_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Super admins can update payouts"
  ON public.payouts FOR UPDATE
  USING (public.has_admin_role(auth.uid(), 'SUPER_ADMIN'));

-- RLS Policies for system_settings
CREATE POLICY "Admins can view system_settings"
  ON public.system_settings FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can update system_settings"
  ON public.system_settings FOR UPDATE
  USING (public.has_admin_role(auth.uid(), 'SUPER_ADMIN'));

-- Create indexes for better performance
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_admin ON public.audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_notifications_log_status ON public.notifications_log(status);
CREATE INDEX idx_notifications_log_order ON public.notifications_log(related_order_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(account_status);
CREATE INDEX idx_vendors_status ON public.vendors(account_status);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_vendor ON public.products(vendor_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_vendor ON public.orders(vendor_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_disputes_status ON public.disputes(status);
CREATE INDEX idx_payouts_status ON public.payouts(status);
CREATE INDEX idx_payouts_recipient ON public.payouts(recipient_type, recipient_id);