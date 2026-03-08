interface CommissionBreakdownProps {
  vendorShare?: number | null;
  affiliateCommission?: number | null;
  platformFee?: number | null;
  orderSource?: string | null;
  formatAmount?: (n: number) => string;
  className?: string;
}

const defaultFormat = (n: number) => `TSh${Number(n || 0).toLocaleString()}`;

export function CommissionBreakdown({
  vendorShare,
  affiliateCommission,
  platformFee,
  orderSource,
  formatAmount = defaultFormat,
  className,
}: CommissionBreakdownProps) {
  const isMarketplace = orderSource?.toUpperCase() === 'MARKETPLACE';

  return (
    <div className={className}>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Vendor Share</span>
        <span className="text-foreground font-medium">{formatAmount(vendorShare ?? 0)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">
          Affiliate Commission
          {isMarketplace && <span className="text-xs ml-1 opacity-60">(N/A)</span>}
        </span>
        <span className="text-foreground font-medium">{formatAmount(affiliateCommission ?? 0)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">
          Platform Fee
          {isMarketplace && <span className="text-xs ml-1 opacity-60">(marketplace commission)</span>}
        </span>
        <span className="text-foreground font-medium">{formatAmount(platformFee ?? 0)}</span>
      </div>
    </div>
  );
}
