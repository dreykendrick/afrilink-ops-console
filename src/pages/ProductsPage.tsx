import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import { Search, Package, RefreshCw, CheckCircle, XCircle, Eye, Image } from 'lucide-react';
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
import type { Product, Vendor } from '@/lib/types';

interface ProductWithVendor extends Product {
  vendors: Vendor | null;
}

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const { createAuditLog } = useAuditLog();
  
  const [products, setProducts] = useState<ProductWithVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVendor | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [viewProduct, setViewProduct] = useState<ProductWithVendor | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, vendors(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts((data as ProductWithVendor[]) || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.vendors?.business_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAction = async (reason?: string) => {
    if (!selectedProduct || !actionType) return;
    
    setIsActionLoading(true);
    try {
      const beforeData = { status: selectedProduct.status };
      const newStatus = actionType === 'approve' ? 'approved' : 'rejected';
      const updateData: { status: string; rejection_reason?: string | null } = { 
        status: newStatus,
        rejection_reason: actionType === 'reject' ? reason : null,
      };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', selectedProduct.id);

      if (error) throw error;

      await createAuditLog({
        actionType: actionType === 'approve' ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
        entityType: 'product',
        entityId: selectedProduct.id,
        beforeData,
        afterData: updateData,
        reason,
      });

      toast.success(`Product ${actionType}d successfully`);
      fetchProducts();
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Action failed. Please try again.');
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
          <h1 className="page-title">Products</h1>
          <p className="text-muted-foreground">Review and moderate product listings</p>
        </div>
        <Button onClick={fetchProducts} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-input border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pending Review Alert */}
      {statusFilter === 'pending' && filteredProducts.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-yellow-400 text-sm">
            <strong>{filteredProducts.length}</strong> products pending review
          </p>
        </div>
      )}

      {/* Products Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={searchQuery || statusFilter !== 'all' 
            ? "Try adjusting your filters" 
            : "Products will appear here once vendors list them"}
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
                  <th>Commission</th>
                  <th>Status</th>
                  <th>Added</th>
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
                    <td className="text-muted-foreground">{product.commission_percent}%</td>
                    <td>
                      <StatusChip status={product.status} />
                    </td>
                    <td className="text-muted-foreground">
                      {formatRelativeDate(product.created_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewProduct(product)}
                          className="action-btn-secondary"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {product.status === 'pending' && (
                          <>
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
                          </>
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

      {/* Product Detail Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Product Details</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              {/* Images */}
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
                  <p className="text-sm text-muted-foreground">Commission</p>
                  <p className="font-medium text-foreground">{viewProduct.commission_percent}%</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusChip status={viewProduct.status} />
                </div>
              </div>
              
              {viewProduct.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-foreground">{viewProduct.description}</p>
                </div>
              )}
              
              {viewProduct.rejection_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Rejection Reason</p>
                  <p className="text-destructive">{viewProduct.rejection_reason}</p>
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
        title={actionType === 'approve' ? 'Approve Product' : 'Reject Product'}
        description={
          actionType === 'approve'
            ? `Approve "${selectedProduct?.name}"? It will be visible to buyers.`
            : `Reject "${selectedProduct?.name}"? Please provide a reason that will be visible to the vendor.`
        }
        confirmLabel={actionType === 'approve' ? 'Approve' : 'Reject'}
        variant={actionType === 'approve' ? 'default' : 'destructive'}
        requireReason={actionType === 'reject'}
        reasonLabel="Rejection reason (visible to vendor)"
        onConfirm={handleAction}
        isLoading={isActionLoading}
      />
    </div>
  );
}
