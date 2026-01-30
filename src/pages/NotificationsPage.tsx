import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/utils';
import { Bell, RefreshCw, RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface NotificationLog { id: string; type: string; masked_recipient: string; status: string; provider: string | null; created_at: string; retry_count: number; }

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('notifications_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) { toast.error('Failed to load notifications'); } else { setLogs((data as NotificationLog[]) || []); }
    setIsLoading(false);
  };

  const handleRetry = async (id: string) => {
    await supabase.from('notifications_log').update({ status: 'pending', retry_count: 1 }).eq('id', id);
    toast.success('Notification queued for retry');
    fetchLogs();
  };

  const filtered = logs.filter((l) => statusFilter === 'all' || l.status === statusFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Notifications Log</h1><p className="text-muted-foreground">View SMS/WhatsApp notification history</p></div>
        <Button onClick={fetchLogs} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <div className="filter-bar">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-input border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <TableSkeleton rows={8} cols={5} /> : filtered.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications found" description="Notification logs will appear here" />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="admin-table"><thead className="bg-secondary/50"><tr><th>Type</th><th>Recipient</th><th>Status</th><th>Provider</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((l) => (
              <tr key={l.id}><td className="text-foreground capitalize">{l.type.replace(/_/g, ' ')}</td><td className="phone-masked text-muted-foreground">{l.masked_recipient}</td>
                <td><StatusChip status={l.status} /></td><td className="text-muted-foreground">{l.provider || '---'}</td>
                <td className="text-muted-foreground">{formatRelativeDate(l.created_at)}</td>
                <td>{l.status === 'failed' && <button onClick={() => handleRetry(l.id)} className="action-btn-secondary"><RotateCcw className="w-4 h-4" /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
