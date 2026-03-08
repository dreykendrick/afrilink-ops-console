import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { MetricCard } from '@/components/MetricCard';
import { LoadingState } from '@/components/LoadingState';
import { formatCurrency } from '@/lib/utils';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Bell,
  AlertTriangle,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import type { DashboardMetrics } from '@/lib/types';

interface QueueItem {
  label: string;
  count: number;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      const weekAgoISO = weekAgo.toISOString();

      // External DB order statuses that indicate payment was received
      // The external DB uses statuses like 'payment_confirmed', 'vendor_notified', etc.
      const paidStatuses = [
        'payment_confirmed', 'vendor_notified', 'out_for_delivery',
        'delivered_pending_confirmation', 'confirmed',
        // Also handle uppercase checkout-style statuses in case of mixed data
        'paid', 'shipped', 'delivered', 'completed',
        'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED',
      ];

      // Fetch all metrics in parallel, catching individual failures
      const [
        ordersToday,
        ordersWeek,
        paidOrdersToday,
        paidOrdersWeek,
        pendingProducts,
        failedNotifications,
        pendingDisputes,
        pendingPayouts,
      ] = await Promise.all([
        externalSupabase
          .from('orders')
          .select('id')
          .gte('created_at', todayISO)
          .then(r => r),
        externalSupabase
          .from('orders')
          .select('id')
          .gte('created_at', weekAgoISO)
          .then(r => r),
        // GMV: only paid orders
        externalSupabase
          .from('orders')
          .select('id, total_amount')
          .gte('created_at', todayISO)
          .in('status', paidStatuses)
          .then(r => r),
        externalSupabase
          .from('orders')
          .select('id, total_amount')
          .gte('created_at', weekAgoISO)
          .in('status', paidStatuses)
          .then(r => r),
        externalSupabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(r => r),
        // External DB uses 'notifications' table
        externalSupabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .then(r => ({ count: r.count || 0 })),
        // Disputes might not exist
        externalSupabase
          .from('disputes')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open')
          .then(r => ({ count: r.count || 0 })),
        // Payouts might not exist
        externalSupabase
          .from('payouts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(r => ({ count: r.count || 0 })),
      ]);

      const ordersDataToday = ordersToday.data || [];
      const ordersDataWeek = ordersWeek.data || [];
      const paidDataToday = paidOrdersToday.data || [];
      const paidDataWeek = paidOrdersWeek.data || [];

      setMetrics({
        ordersToday: ordersDataToday.length,
        ordersThisWeek: ordersDataWeek.length,
        gmvToday: paidDataToday.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
        gmvThisWeek: paidDataWeek.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
        pendingProductReviews: pendingProducts.count || 0,
        failedNotifications: (failedNotifications as any).count || 0,
        pendingDisputes: (pendingDisputes as any).count || 0,
        pendingPayouts: (pendingPayouts as any).count || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  const queues: QueueItem[] = [
    {
      label: 'Pending Product Reviews',
      count: metrics?.pendingProductReviews || 0,
      path: '/products?status=pending',
      icon: Package,
      color: 'bg-yellow-500/20 text-yellow-400',
    },
    {
      label: 'Failed Notifications',
      count: metrics?.failedNotifications || 0,
      path: '/notifications?status=failed',
      icon: Bell,
      color: 'bg-red-500/20 text-red-400',
    },
    {
      label: 'Open Disputes',
      count: metrics?.pendingDisputes || 0,
      path: '/disputes?status=open',
      icon: AlertTriangle,
      color: 'bg-orange-500/20 text-orange-400',
    },
    {
      label: 'Pending Payouts',
      count: metrics?.pendingPayouts || 0,
      path: '/payments?status=pending',
      icon: CreditCard,
      color: 'bg-blue-500/20 text-blue-400',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to AfriLink Admin</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Orders Today"
          value={metrics?.ordersToday || 0}
          icon={ShoppingCart}
        />
        <MetricCard
          title="Orders This Week"
          value={metrics?.ordersThisWeek || 0}
          icon={ShoppingCart}
        />
        <MetricCard
          title="GMV Today"
          value={formatCurrency(metrics?.gmvToday || 0)}
          icon={DollarSign}
        />
        <MetricCard
          title="GMV This Week"
          value={formatCurrency(metrics?.gmvThisWeek || 0)}
          icon={DollarSign}
        />
      </div>

      {/* Action Queues */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Action Queues</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {queues.map((queue) => (
            <button
              key={queue.path}
              onClick={() => navigate(queue.path)}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${queue.color}`}>
                  <queue.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{queue.label}</p>
                  <p className="text-2xl font-bold text-foreground">{queue.count}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Placeholder */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/products?status=pending')}
              className="w-full flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <span className="text-sm text-foreground">Review Pending Products</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="w-full flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <span className="text-sm text-foreground">View All Orders</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/vendors?status=pending')}
              className="w-full flex items-center justify-between p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <span className="text-sm text-foreground">Approve Vendors</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Database</span>
              <span className="status-chip status-active">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Notifications</span>
              <span className={`status-chip ${(metrics?.failedNotifications || 0) > 0 ? 'status-pending' : 'status-active'}`}>
                {(metrics?.failedNotifications || 0) > 0 ? 'Issues Detected' : 'Operational'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payments</span>
              <span className="status-chip status-active">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
