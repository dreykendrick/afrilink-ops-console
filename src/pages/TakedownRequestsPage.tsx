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
import { Search, PackageX, RefreshCw, CheckCircle, XCircle, Eye, Image } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Product, Vendor } from '@/lib/types';

interface ProductWithVendor extends Product {
  vendors: Vendor | null;
}

export default function TakedownRequestsPage() {
  const { createAuditLog } = useAuditLog();
  
  const [products, setProducts] = useState<ProductWithVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVendor | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [viewProduct, setViewProduct] = useState<ProductWithVendor | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchTakedownRequests();
  }, []);

  const fetchTakedownRequests = async () => {
    try {
      setIsLoading(true);
      
      // Fetch products with pending_takedown status
      const { data: productsData, error: productsError } = await externalSupabase
        .from('products')
        .select('*')
        .eq('status', 'pending_takedown')
        .order('updated_at', { ascending: false });

      if (productsError) throw productsError;

      // Get vendor data
      const vendorUserIds = [...new Set((productsData || []).map(p => p.vendor_id).filter(Boolean))];
      let vendorsMap: Record<string, Vendor> = {};
      
      if (vendorUserIds.length > 0) {
        const { data: vendorsData } = await externalSupabase
          .from('vendor_profiles')
          .select('*')
          .in('user_id', vendorUserIds);
        
        vendorsMap = (vendorsData || []).reduce((acc, v: Record<string, unknown>) => {
          const userId = v.user_id as string;
          acc[userId] = {
            id: v.id as string,
            user_id: userId,
            business_name: (v.business_name || v.name || v.shop_name || v.store_name || 'Unknown Vendor') as string,
            city: v.city as string || null,
            phone: v.phone as string || null,
            verification_status: (v.verification_status || v.verified || 'pending') as 'pending' | 'verified' | 'rejected',
            account_status: (v.account_status || v.status || 'pending') as 'pending' | 'active' | 'suspended',
            total_orders: v.total_orders as number || 0,
            total_revenue: v.total_revenue as number || 0,
            created_at: v.created_at as string || '',
            updated_at: v.updated_at as string || '',
          };
          return acc;
        }, {} as Record<string, Vendor>);
      }

      // Map to expected format
      const productsWithVendors = (productsData || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        vendor_id: p.vendor_id as string,
        name: (p.title || p.name || 'Untitled Product') as string,
        description: p.description as string | null,
        price: p.price as number,
        images: (p.image_urls || (p.image_url ? [p.image_url] : null) || p.images) as string[] | null,
        commission_percent: (p.commission ?? p.commission_percent ?? 10) as number,
        status: p.status as 'pending' | 'approved' | 'rejected',
        rejection_reason: p.rejection_reason as string | null,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
        vendors: vendorsMap[p.vendor_id as string] || null,
      })) as ProductWithVendor[];

      setProducts(productsWithVendors);
    } catch (error) {
      console.error('Error fetching takedown requests:', error);
      toast.error('Failed to load takedown requests');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    return (
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.vendors?.business_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleAction = async (reason?: string) => {
    if (!selectedProduct || !actionType) return;
    
    setIsActionLoading(true);
    try {
      const beforeData = { status: selectedProduct.status };
      const newStatus = actionType === 'approve' ? 'taken_down' : 'approved';
      const isAvailable = actionType !== 'approve';
      
      // Directly update the product status in the external database
      const { error } = await externalSupabase
        .from('products')
        .update({ status: newStatus, is_available: isAvailable })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      // Log to local audit system as well
      await createAuditLog({
        actionType: actionType === 'approve' ? 'TAKEDOWN_APPROVED' : 'TAKEDOWN_REJECTED',
        entityType: 'product',
        entityId: selectedProduct.id,
        beforeData,
        afterData: { status: newStatus, is_available: isAvailable },
        reason,
      });

      toast.success(`Takedown ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchTakedownRequests();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error(error instanceof Error ? error.message : 'Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
      setSelectedProduct(null);
      setActionType(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Takedown Requests</h1>
          <p className="text-muted-foreground">Review vendor requests to remove their products</p>
        </div>
        <Button onClick={fetchTakedownRequests} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by product name or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
      </div>

      {/* Pending Count */}
      {filteredProducts.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <p className="text-orange-400 text-sm">
            <strong>{filteredProducts.length}</strong> takedown request{filteredProducts.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={PackageX}
          title="No takedown requests"
          description={searchQuery 
            ? "No requests match your search" 
            : "No vendors have requested product takedowns"}
        />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="bg-secondary/50">
                <tr>
                  <th>Product</th>
                  <th>Vendor</th>
                  <th>Price</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center overflow-hidden">
                          {product.images && product.images[0] ? (
                            <img 
                              src={product.images[0]} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Image className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <p className="font-medium text-foreground">{product.name}</p>
                      </div>
                    </td>
                    <td className="text-muted-foreground">
                      {product.vendors?.business_name || '---'}
                    </td>
                    <td className="text-foreground font-medium">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="text-muted-foreground">
                      {formatRelativeDate(product.updated_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewProduct(product)}
                          className="action-btn-secondary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setActionType('approve');
                          }}
                          className="action-btn-primary"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setActionType('reject');
                          }}
                          className="action-btn-destructive"
                        >
                          <XCircle className="w-4 h-4" />
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

      {/* Product Detail Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Product Details</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              {viewProduct.images && viewProduct.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {viewProduct.images.slice(0, 3).map((img, i) => (
                    <div key={i} className="aspect-square bg-secondary rounded-lg overflow-hidden">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">{viewProduct.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="font-medium text-foreground">{formatCurrency(viewProduct.price)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium text-foreground">{viewProduct.vendors?.business_name || '---'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusChip status="pending_takedown" />
                </div>
              </div>
              
              {viewProduct.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-foreground">{viewProduct.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={!!selectedProduct && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProduct(null);
            setActionType(null);
          }
        }}
        title={actionType === 'approve' ? 'Approve Takedown' : 'Reject Takedown'}
        description={
          actionType === 'approve'
            ? `Remove "${selectedProduct?.name}" from the marketplace? This will hide it from buyers.`
            : `Keep "${selectedProduct?.name}" active? Please provide a reason for the vendor.`
        }
        confirmLabel={actionType === 'approve' ? 'Approve Takedown' : 'Reject'}
        variant={actionType === 'approve' ? 'default' : 'destructive'}
        requireReason={actionType === 'reject'}
        reasonLabel="Reason for rejection (visible to vendor)"
        onConfirm={handleAction}
        isLoading={isActionLoading}
      />
    </div>
  );
}
