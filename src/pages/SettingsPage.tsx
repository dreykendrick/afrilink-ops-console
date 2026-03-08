import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('system_settings').select('key, value');
    const map: Record<string, string> = {};
    data?.forEach((s) => { map[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value); });
    setSettings(map);
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      // system_settings.value is jsonb — wrap raw strings so they store as valid JSON
      let jsonValue: unknown;
      try {
        jsonValue = JSON.parse(value);
      } catch {
        jsonValue = value;
      }
      await supabase.from('system_settings').update({ value: jsonValue }).eq('key', key);
    }
    toast.success('Settings saved');
    setIsSaving(false);
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">System Settings</h1><p className="text-muted-foreground">Configure platform settings (SUPER_ADMIN only)</p></div>
        <Button onClick={handleSave} disabled={isSaving}><Save className="w-4 h-4 mr-2" />{isSaving ? 'Saving...' : 'Save Changes'}</Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><Label className="text-foreground">Maintenance Mode</Label><p className="text-sm text-muted-foreground">Disable public access to the platform</p></div>
          <Switch checked={settings.maintenance_mode === 'true'} onCheckedChange={(c) => setSettings({ ...settings, maintenance_mode: c ? 'true' : 'false' })} />
        </div>

        <div className="border-t border-border pt-6">
          <Label className="text-foreground">Auto-Confirm Days</Label>
          <p className="text-sm text-muted-foreground mb-2">Days before auto-confirming delivery</p>
          <Input type="number" value={settings.auto_confirm_days || '7'} onChange={(e) => setSettings({ ...settings, auto_confirm_days: e.target.value })} className="bg-input max-w-xs" />
        </div>

        <div className="border-t border-border pt-6">
          <Label className="text-foreground">Platform Commission (%)</Label>
          <p className="text-sm text-muted-foreground mb-2">Default commission percentage</p>
          <Input type="number" value={settings.platform_commission_percent || '10'} onChange={(e) => setSettings({ ...settings, platform_commission_percent: e.target.value })} className="bg-input max-w-xs" />
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-400 text-sm"><strong>Note:</strong> API keys and SMS credentials are stored as environment secrets and cannot be edited here.</p>
      </div>
    </div>
  );
}
