import { useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { Truck, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface SameCityZone { id: string; city: string; zone_name: string; fee: number; is_active: boolean; }
interface CrossCityFee { id: string; from_city: string; to_city: string; fee: number; is_active: boolean; }

export default function DeliveryPage() {
  const [zones, setZones] = useState<SameCityZone[]>([]);
  const [crossFees, setCrossFees] = useState<CrossCityFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [showCrossDialog, setShowCrossDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<SameCityZone | null>(null);
  const [editingCross, setEditingCross] = useState<CrossCityFee | null>(null);
  const [zoneForm, setZoneForm] = useState({ city: '', zone_name: '', fee: '' });
  const [crossForm, setCrossForm] = useState({ from_city: '', to_city: '', fee: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [zonesRes, crossRes] = await Promise.all([
      externalSupabase.from('delivery_zones').select('*').order('city'),
      externalSupabase.from('cross_city_fees').select('*').order('from_city'),
    ]);
    const mappedZones = (zonesRes.data || []).map((z: Record<string, unknown>) => ({
      id: z.id as string,
      city: z.city as string || '',
      zone_name: z.zone_name as string || z.name as string || '',
      fee: (z.delivery_fee as number) ?? (z.fee as number) ?? 0,
      is_active: z.is_active as boolean ?? true,
    }));
    const mappedRoutes = (crossRes.data || []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      from_city: c.from_city as string || '',
      to_city: c.to_city as string || '',
      fee: (c.delivery_fee as number) ?? (c.fee as number) ?? 0,
      is_active: c.is_active as boolean ?? true,
    }));
    setZones(mappedZones);
    setCrossFees(mappedRoutes);
    setIsLoading(false);
  };

  const handleSaveZone = async () => {
    const feeVal = parseFloat(zoneForm.fee) || 0;
    const data: Record<string, unknown> = { city: zoneForm.city, zone_name: zoneForm.zone_name, base_fee: feeVal };
    let error;
    if (editingZone) {
      ({ error } = await externalSupabase.from('delivery_zones').update(data).eq('id', editingZone.id));
    } else {
      ({ error } = await externalSupabase.from('delivery_zones').insert(data));
    }
    if (error) { toast.error(error.message); return; }
    toast.success('Zone saved');
    setShowZoneDialog(false);
    setEditingZone(null);
    setZoneForm({ city: '', zone_name: '', fee: '' });
    fetchData();
  };

  const handleSaveCross = async () => {
    const data = { from_city: crossForm.from_city, to_city: crossForm.to_city, delivery_fee: parseFloat(crossForm.fee) || 0 };
    let error;
    if (editingCross) {
      ({ error } = await externalSupabase.from('cross_city_fees').update(data).eq('id', editingCross.id));
    } else {
      ({ error } = await externalSupabase.from('cross_city_fees').insert(data));
    }
    if (error) { toast.error(error.message); return; }
    toast.success('Cross-city fee saved');
    setShowCrossDialog(false);
    setEditingCross(null);
    setCrossForm({ from_city: '', to_city: '', fee: '' });
    fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Delivery Pricing</h1><p className="text-muted-foreground">Manage delivery zones and fees</p></div>
        <Button onClick={fetchData} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {/* Same City Zones */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Same-City Zones</h3>
          <Button size="sm" onClick={() => { setEditingZone(null); setZoneForm({ city: '', zone_name: '', fee: '' }); setShowZoneDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Zone
          </Button>
        </div>
        {isLoading ? <TableSkeleton rows={3} cols={4} /> : zones.length === 0 ? (
          <EmptyState icon={Truck} title="No zones configured" description="Add delivery zones to start" />
        ) : (
          <table className="admin-table"><thead className="bg-secondary/50"><tr><th>City</th><th>Zone</th><th>Fee</th><th>Actions</th></tr></thead>
            <tbody>{zones.map((z) => (
              <tr key={z.id}><td className="text-foreground">{z.city}</td><td className="text-muted-foreground">{z.zone_name}</td>
                <td className="text-foreground font-medium">{formatCurrency(z.fee)}</td>
                <td><button onClick={() => { setEditingZone(z); setZoneForm({ city: z.city, zone_name: z.zone_name, fee: z.fee.toString() }); setShowZoneDialog(true); }} className="action-btn-secondary"><Pencil className="w-4 h-4" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Cross City Fees */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Cross-City Fees</h3>
          <Button size="sm" onClick={() => { setEditingCross(null); setCrossForm({ from_city: '', to_city: '', fee: '' }); setShowCrossDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Route
          </Button>
        </div>
        {isLoading ? <TableSkeleton rows={3} cols={4} /> : crossFees.length === 0 ? (
          <EmptyState icon={Truck} title="No routes configured" description="Add cross-city routes to start" />
        ) : (
          <table className="admin-table"><thead className="bg-secondary/50"><tr><th>From</th><th>To</th><th>Fee</th><th>Actions</th></tr></thead>
            <tbody>{crossFees.map((c) => (
              <tr key={c.id}><td className="text-foreground">{c.from_city}</td><td className="text-foreground">{c.to_city}</td>
                <td className="text-foreground font-medium">{formatCurrency(c.fee)}</td>
                <td><button onClick={() => { setEditingCross(c); setCrossForm({ from_city: c.from_city, to_city: c.to_city, fee: c.fee.toString() }); setShowCrossDialog(true); }} className="action-btn-secondary"><Pencil className="w-4 h-4" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Zone Dialog */}
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="bg-card border-border"><DialogHeader><DialogTitle>{editingZone ? 'Edit Zone' : 'Add Zone'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>City</Label><Input value={zoneForm.city} onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })} className="bg-input" /></div>
            <div><Label>Zone Name</Label><Input value={zoneForm.zone_name} onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })} className="bg-input" /></div>
            <div><Label>Fee (NGN)</Label><Input type="number" value={zoneForm.fee} onChange={(e) => setZoneForm({ ...zoneForm, fee: e.target.value })} className="bg-input" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveZone}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cross Dialog */}
      <Dialog open={showCrossDialog} onOpenChange={setShowCrossDialog}>
        <DialogContent className="bg-card border-border"><DialogHeader><DialogTitle>{editingCross ? 'Edit Route' : 'Add Route'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>From City</Label><Input value={crossForm.from_city} onChange={(e) => setCrossForm({ ...crossForm, from_city: e.target.value })} className="bg-input" /></div>
            <div><Label>To City</Label><Input value={crossForm.to_city} onChange={(e) => setCrossForm({ ...crossForm, to_city: e.target.value })} className="bg-input" /></div>
            <div><Label>Fee (NGN)</Label><Input type="number" value={crossForm.fee} onChange={(e) => setCrossForm({ ...crossForm, fee: e.target.value })} className="bg-input" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveCross}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
