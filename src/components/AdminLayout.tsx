import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  Bell,
  AlertTriangle,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface NavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
  onClick?: () => void;
}

function NavItem({ to, icon: Icon, label, badge, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent'
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { adminUser, signOut, isSuperAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/vendors', icon: Store, label: 'Vendors' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/delivery', icon: Truck, label: 'Delivery Pricing' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/disputes', icon: AlertTriangle, label: 'Disputes' },
  ];

  if (isSuperAdmin) {
    navItems.push({ to: '/settings', icon: Settings, label: 'Settings' });
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-foreground">AfriLink</span>
            <span className="text-primary font-bold ml-1">Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User / Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-foreground">
                {adminUser?.full_name?.charAt(0) || adminUser?.email?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {adminUser?.full_name || adminUser?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {adminUser?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Ops Admin'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">AfriLink Admin</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-sidebar-accent rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu */}
      <aside
        className={cn(
          'lg:hidden fixed top-16 left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-200',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <nav className="p-4 space-y-1 overflow-y-auto h-full scrollbar-thin">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} onClick={closeMobileMenu} />
          ))}
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 overflow-auto">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
