import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/utils';
import { AlertTriangle, RefreshCw, CheckCircle, MessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Dispute { id: string; order_id: string; reason: string; buyer_note: string | null; status: string; created_at: string; }

export default function DisputesPage() {
  const { isSuperAdmin, adminUser } = useAuth();
  const { createAuditLog } = useAuditLog();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => { fetchDisputes(); }, []);

  const fetchDisputes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('disputes').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Failed to load disputes'); } else { setDisputes((data as Dispute[]) || []); }
    setIsLoading(false);
  };

  const handleResolve = async (note?: string) => {
    if (!selectedDispute || !adminUser) return;
    setIsActionLoading(true);
    const { error } = await supabase.from('disputes').update({ status: 'resolved', resolution_note: note, resolved_by: adminUser.id, resolved_at: new Date().toISOString() }).eq('id', selectedDispute.id);
    if (error) { toast.error('Failed to resolve dispute'); } else {
      await createAuditLog({ actionType: 'DISPUTE_RESOLVED', entityType: 'dispute', entityId: selectedDispute.id, beforeData: { status: 'open' }, afterData: { status: 'resolved' }, reason: note });
      toast.success('Dispute resolved');
      fetchDisputes();
    }
    setIsActionLoading(false);
    setSelectedDispute(null);
  };

  const filtered = disputes.filter((d) => statusFilter === 'all' || d.status === statusFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Disputes</h1><p className="text-muted-foreground">Manage order disputes</p></div>
        <Button onClick={fetchDisputes} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <div className="filter-bar">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-input border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover border-border"><SelectItem value="all">All</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton rows={6} cols={5} /> : filtered.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No disputes found" description="Disputes will appear here when buyers raise issues" />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="admin-table"><thead className="bg-secondary/50"><tr><th>Reason</th><th>Note</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((d) => (
              <tr key={d.id}><td className="text-foreground">{d.reason}</td><td className="text-muted-foreground max-w-xs truncate">{d.buyer_note || '---'}</td>
                <td><StatusChip status={d.status} /></td><td className="text-muted-foreground">{formatRelativeDate(d.created_at)}</td>
                <td>{d.status === 'open' && isSuperAdmin && <button onClick={() => setSelectedDispute(d)} className="action-btn-primary"><CheckCircle className="w-4 h-4" />Resolve</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!selectedDispute} onOpenChange={(o) => !o && setSelectedDispute(null)} title="Resolve Dispute" description="Provide resolution notes for this dispute." confirmLabel="Resolve" variant="default" requireReason reasonLabel="Resolution note" onConfirm={handleResolve} isLoading={isActionLoading} />
    </div>
  );
}
