import { cn } from '@/lib/utils';
import { Store, Users } from 'lucide-react';

interface OrderSourceBadgeProps {
  source: string | null | undefined;
  className?: string;
}

const sourceConfig: Record<string, { label: string; icon: typeof Store; style: string }> = {
  MARKETPLACE: {
    label: 'Marketplace',
    icon: Store,
    style: 'bg-blue-500/20 text-blue-400',
  },
  AFFILIATE: {
    label: 'Affiliate',
    icon: Users,
    style: 'bg-purple-500/20 text-purple-400',
  },
};

export function OrderSourceBadge({ source, className }: OrderSourceBadgeProps) {
  const key = source?.toUpperCase() || '';
  const config = sourceConfig[key];

  if (!config) {
    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground', className)}>
        {source || '—'}
      </span>
    );
  }

  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', config.style, className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
