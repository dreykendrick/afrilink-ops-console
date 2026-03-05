import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { Truck, Plus, RefreshCw, Pencil, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface City { id: string; name: string; }
interface Zone { id: string; city_id: string; zone_name: string; fee: number; city?: { name: string }; }
interface CrossCityFee { id: string; from_city_id: string; to_city_id: string; fee: number; from_city?: { name: string }; to_city?: { name: string }; }

export default function DeliveryPage() {
  const { callApi, isLoading: apiLoading } = useCheckoutApi();
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [crossFees, setCrossFees] = useState<CrossCityFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // City dialog
  const [showCityDialog, setShowCityDialog] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [cityForm, setCityForm] = useState({ name: '' });

  // Zone dialog
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({ city_id: '', zone_name: '', fee: '' });

  // Cross-city dialog
  const [showCrossDialog, setShowCrossDialog] = useState(false);
  const [editingCross, setEditingCross] = useState<CrossCityFee | null>(null);
  const [crossForm, setCrossForm] = useState({ from_city_id: '', to_city_id: '', fee: '' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [citiesRes, zonesRes, crossRes] = await Promise.all([
      callApi<City[]>({ path: '/admin/cities', showErrorToast: false }),
      callApi<Zone[]>({ path: '/admin/zones', showErrorToast: false }),
      callApi<CrossCityFee[]>({ path: '/admin/cross-city-fees', showErrorToast: false }),
    ]);
    const extractArray = (res: any): any[] => {
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.data)) return res.data;
      return [];
    };
    console.log('[Delivery] citiesRes.data:', JSON.stringify(citiesRes.data));
    console.log('[Delivery] zonesRes.data:', JSON.stringify(zonesRes.data));
    setCities(extractArray(citiesRes.data));
    setZones(extractArray(zonesRes.data));
    setCrossFees(extractArray(crossRes.data));

    // Sync to local DB in background
    syncToLocalDb(zonesRes.data || [], crossRes.data || [], citiesRes.data || []);

    setIsLoading(false);
  }, [callApi]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const syncToLocalDb = async (zones: Zone[], crossFees: CrossCityFee[], cities: City[]) => {
    try {
      const cityMap = Object.fromEntries(cities.map(c => [c.id, c.name]));

      // Sync zones to same_city_zones
      for (const z of zones) {
        const cityName = z.city?.name || cityMap[z.city_id] || '';
        await supabase.from('same_city_zones').upsert({
          id: z.id,
          city: cityName,
          zone_name: z.zone_name,
          fee: z.fee,
          is_active: true,
        }, { onConflict: 'id' });
      }

      // Sync cross-city fees
      for (const c of crossFees) {
        const fromName = c.from_city?.name || cityMap[c.from_city_id] || '';
        const toName = c.to_city?.name || cityMap[c.to_city_id] || '';
        await supabase.from('cross_city_fees').upsert({
          id: c.id,
          from_city: fromName,
          to_city: toName,
          fee: c.fee,
          is_active: true,
        }, { onConflict: 'id' });
      }
    } catch (err) {
      console.error('[DeliverySync] Local sync error:', err);
    }
  };

  // ---- City CRUD ----
  const handleSaveCity = async () => {
    if (!cityForm.name.trim()) { toast.error('City name is required'); return; }
    const payload = { name: cityForm.name.trim() };
    let res;
    if (editingCity) {
      res = await callApi({ path: `/admin/cities/${editingCity.id}`, method: 'PUT', payload });
    } else {
      res = await callApi({ path: '/admin/cities', method: 'POST', payload });
    }
    if (!res.error) {
      toast.success(editingCity ? 'City updated' : 'City added');
      setShowCityDialog(false);
      setEditingCity(null);
      setCityForm({ name: '' });
      fetchData();
    }
  };

  const handleDeleteCity = async (id: string) => {
    const res = await callApi({ path: `/admin/cities/${id}`, method: 'DELETE' });
    if (!res.error) { toast.success('City deleted'); fetchData(); }
  };

  // ---- Zone CRUD ----
  const handleSaveZone = async () => {
    if (!zoneForm.city_id || !zoneForm.zone_name.trim()) { toast.error('City and zone name are required'); return; }
    const payload = { city_id: zoneForm.city_id, zone_name: zoneForm.zone_name.trim(), fee: parseFloat(zoneForm.fee) || 0 };
    let res;
    if (editingZone) {
      res = await callApi({ path: `/admin/zones/${editingZone.id}`, method: 'PUT', payload });
    } else {
      res = await callApi({ path: '/admin/zones', method: 'POST', payload });
    }
    if (!res.error) {
      // Also sync to local DB
      const cityName = cities.find(c => c.id === zoneForm.city_id)?.name || '';
      const localData = { city: cityName, zone_name: zoneForm.zone_name.trim(), fee: parseFloat(zoneForm.fee) || 0 };
      if (editingZone) {
        await supabase.from('same_city_zones').update(localData).eq('id', editingZone.id);
      } else if ((res.data as any)?.id) {
        await supabase.from('same_city_zones').insert({ id: (res.data as any).id, ...localData, is_active: true });
      }
      toast.success('Zone saved');
      setShowZoneDialog(false);
      setEditingZone(null);
      setZoneForm({ city_id: '', zone_name: '', fee: '' });
      fetchData();
    }
  };

  const handleDeleteZone = async (id: string) => {
    const res = await callApi({ path: `/admin/zones/${id}`, method: 'DELETE' });
    if (!res.error) {
      await supabase.from('same_city_zones').delete().eq('id', id);
      toast.success('Zone deleted');
      fetchData();
    }
  };

  // ---- Cross-City CRUD ----
  const handleSaveCross = async () => {
    if (!crossForm.from_city_id || !crossForm.to_city_id) { toast.error('Both cities are required'); return; }
    const payload = { from_city_id: crossForm.from_city_id, to_city_id: crossForm.to_city_id, fee: parseFloat(crossForm.fee) || 0 };
    let res;
    if (editingCross) {
      res = await callApi({ path: `/admin/cross-city-fees/${editingCross.id}`, method: 'PUT', payload });
    } else {
      res = await callApi({ path: '/admin/cross-city-fees', method: 'POST', payload });
    }
    if (!res.error) {
      const fromName = cities.find(c => c.id === crossForm.from_city_id)?.name || '';
      const toName = cities.find(c => c.id === crossForm.to_city_id)?.name || '';
      const localData = { from_city: fromName, to_city: toName, fee: parseFloat(crossForm.fee) || 0 };
      if (editingCross) {
        await supabase.from('cross_city_fees').update(localData).eq('id', editingCross.id);
      } else if ((res.data as any)?.id) {
        await supabase.from('cross_city_fees').insert({ id: (res.data as any).id, ...localData, is_active: true });
      }
      toast.success('Route saved');
      setShowCrossDialog(false);
      setEditingCross(null);
      setCrossForm({ from_city_id: '', to_city_id: '', fee: '' });
      fetchData();
    }
  };

  const handleDeleteCross = async (id: string) => {
    const res = await callApi({ path: `/admin/cross-city-fees/${id}`, method: 'DELETE' });
    if (!res.error) {
      await supabase.from('cross_city_fees').delete().eq('id', id);
      toast.success('Route deleted');
      fetchData();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Delivery Pricing</h1>
          <p className="text-muted-foreground">Manage cities, delivery zones and cross-city fees</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={isLoading || apiLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <Tabs defaultValue="zones" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="cities">Cities</TabsTrigger>
          <TabsTrigger value="zones">Same-City Zones</TabsTrigger>
          <TabsTrigger value="cross">Cross-City Fees</TabsTrigger>
        </TabsList>

        {/* Cities Tab */}
        <TabsContent value="cities">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Cities</h3>
              <Button size="sm" onClick={() => { setEditingCity(null); setCityForm({ name: '' }); setShowCityDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />Add City
              </Button>
            </div>
            {isLoading ? <TableSkeleton rows={3} cols={2} /> : cities.length === 0 ? (
              <EmptyState icon={MapPin} title="No cities configured" description="Add cities first, then create delivery zones" />
            ) : (
              <table className="admin-table">
                <thead className="bg-secondary/50"><tr><th>City Name</th><th>Actions</th></tr></thead>
                <tbody>{cities.map((c) => (
                  <tr key={c.id}>
                    <td className="text-foreground font-medium">{c.name}</td>
                    <td className="flex gap-1">
                      <button onClick={() => { setEditingCity(c); setCityForm({ name: c.name }); setShowCityDialog(true); }} className="action-btn-secondary"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteCity(c.id)} className="action-btn-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Same-City Zones Tab */}
        <TabsContent value="zones">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Same-City Zones</h3>
              <Button size="sm" onClick={() => { setEditingZone(null); setZoneForm({ city_id: '', zone_name: '', fee: '' }); setShowZoneDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />Add Zone
              </Button>
            </div>
            {isLoading ? <TableSkeleton rows={3} cols={4} /> : zones.length === 0 ? (
              <EmptyState icon={Truck} title="No zones configured" description="Add cities first, then create delivery zones" />
            ) : (
              <table className="admin-table">
                <thead className="bg-secondary/50"><tr><th>City</th><th>Zone</th><th>Fee</th><th>Actions</th></tr></thead>
                <tbody>{zones.map((z) => (
                  <tr key={z.id}>
                    <td className="text-foreground">{z.city?.name || '—'}</td>
                    <td className="text-muted-foreground">{z.zone_name}</td>
                    <td className="text-foreground font-medium">{formatCurrency(z.fee)}</td>
                    <td className="flex gap-1">
                      <button onClick={() => { setEditingZone(z); setZoneForm({ city_id: z.city_id, zone_name: z.zone_name, fee: z.fee.toString() }); setShowZoneDialog(true); }} className="action-btn-secondary"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteZone(z.id)} className="action-btn-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Cross-City Fees Tab */}
        <TabsContent value="cross">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Cross-City Fees</h3>
              <Button size="sm" onClick={() => { setEditingCross(null); setCrossForm({ from_city_id: '', to_city_id: '', fee: '' }); setShowCrossDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />Add Route
              </Button>
            </div>
            {isLoading ? <TableSkeleton rows={3} cols={4} /> : crossFees.length === 0 ? (
              <EmptyState icon={Truck} title="No routes configured" description="Add cross-city delivery routes" />
            ) : (
              <table className="admin-table">
                <thead className="bg-secondary/50"><tr><th>From</th><th>To</th><th>Fee</th><th>Actions</th></tr></thead>
                <tbody>{crossFees.map((c) => (
                  <tr key={c.id}>
                    <td className="text-foreground">{c.from_city?.name || '—'}</td>
                    <td className="text-foreground">{c.to_city?.name || '—'}</td>
                    <td className="text-foreground font-medium">{formatCurrency(c.fee)}</td>
                    <td className="flex gap-1">
                      <button onClick={() => { setEditingCross(c); setCrossForm({ from_city_id: c.from_city_id, to_city_id: c.to_city_id, fee: c.fee.toString() }); setShowCrossDialog(true); }} className="action-btn-secondary"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteCross(c.id)} className="action-btn-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* City Dialog */}
      <Dialog open={showCityDialog} onOpenChange={setShowCityDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editingCity ? 'Edit City' : 'Add City'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>City Name</Label><Input value={cityForm.name} onChange={(e) => setCityForm({ name: e.target.value })} className="bg-input" placeholder="e.g. Dar es Salaam" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveCity} disabled={apiLoading}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zone Dialog */}
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editingZone ? 'Edit Zone' : 'Add Zone'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>City</Label>
              <Select value={zoneForm.city_id} onValueChange={(v) => setZoneForm({ ...zoneForm, city_id: v })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Zone Name</Label><Input value={zoneForm.zone_name} onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })} className="bg-input" placeholder="e.g. Mbezi" /></div>
            <div><Label>Fee (TSH)</Label><Input type="number" value={zoneForm.fee} onChange={(e) => setZoneForm({ ...zoneForm, fee: e.target.value })} className="bg-input" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveZone} disabled={apiLoading}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cross-City Dialog */}
      <Dialog open={showCrossDialog} onOpenChange={setShowCrossDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editingCross ? 'Edit Route' : 'Add Route'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>From City</Label>
              <Select value={crossForm.from_city_id} onValueChange={(v) => setCrossForm({ ...crossForm, from_city_id: v })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select origin city" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>To City</Label>
              <Select value={crossForm.to_city_id} onValueChange={(v) => setCrossForm({ ...crossForm, to_city_id: v })}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select destination city" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fee (TSH)</Label><Input type="number" value={crossForm.fee} onChange={(e) => setCrossForm({ ...crossForm, fee: e.target.value })} className="bg-input" /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveCross} disabled={apiLoading}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
