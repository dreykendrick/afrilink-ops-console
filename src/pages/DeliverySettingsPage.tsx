import { useEffect, useState, useCallback } from 'react';
import { useCheckoutApi } from '@/hooks/useCheckoutApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/LoadingState';
import { Truck, Save, RefreshCw, Calculator, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DeliverySettings {
  enabled: boolean;
  base_fee: number;
  price_per_km: number;
  minimum_fee: number;
  maximum_fee: number | null;
  free_delivery_threshold: number | null;
  max_delivery_distance_km: number | null;
}

const DEFAULT_SETTINGS: DeliverySettings = {
  enabled: false,
  base_fee: 0,
  price_per_km: 0,
  minimum_fee: 0,
  maximum_fee: null,
  free_delivery_threshold: null,
  max_delivery_distance_km: null,
};

function validateSettings(s: DeliverySettings): string | null {
  if (s.base_fee < 0) return 'Base fee must be >= 0';
  if (s.price_per_km < 0) return 'Price per km must be >= 0';
  if (s.minimum_fee < 0) return 'Minimum fee must be >= 0';
  if (s.maximum_fee !== null && s.maximum_fee < s.minimum_fee) return 'Maximum fee must be >= minimum fee';
  if (s.free_delivery_threshold !== null && s.free_delivery_threshold < 0) return 'Free delivery threshold must be >= 0';
  if (s.max_delivery_distance_km !== null && s.max_delivery_distance_km <= 0) return 'Max delivery distance must be > 0';
  return null;
}

function formatTSH(v: number) {
  return `TSH ${v.toLocaleString()}`;
}

function FormulaPreview({ settings }: { settings: DeliverySettings }) {
  const exampleDistance = 5;
  const raw = settings.base_fee + exampleDistance * settings.price_per_km;
  let fee = Math.max(raw, settings.minimum_fee);
  if (settings.maximum_fee !== null) fee = Math.min(fee, settings.maximum_fee);

  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          Formula Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="font-mono text-xs bg-secondary/50 p-3 rounded-md space-y-1">
          <p className="text-muted-foreground">// Step 1: Calculate raw fee</p>
          <p className="text-foreground">raw = base_fee + (distance_km × price_per_km)</p>
          <p className="text-muted-foreground">// Step 2: Apply minimum</p>
          <p className="text-foreground">fee = max(raw, minimum_fee)</p>
          {settings.maximum_fee !== null && (
            <>
              <p className="text-muted-foreground">// Step 3: Cap at maximum</p>
              <p className="text-foreground">fee = min(fee, maximum_fee)</p>
            </>
          )}
          {settings.free_delivery_threshold !== null && (
            <>
              <p className="text-muted-foreground">// Step 4: Free delivery override</p>
              <p className="text-foreground">if (order_total {'>'} {formatTSH(settings.free_delivery_threshold)}) fee = 0</p>
            </>
          )}
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Example ({exampleDistance} km):</span>
          <span className="font-semibold text-foreground">{formatTSH(fee)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeliverySettingsPage() {
  const { callApi, isLoading: apiLoading } = useCheckoutApi();
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedSettings, setSavedSettings] = useState<DeliverySettings>(DEFAULT_SETTINGS);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try checkout API first
      const res = await callApi<DeliverySettings>({ path: '/admin/delivery-settings', showErrorToast: false });
      if (res.data && typeof res.data === 'object' && 'enabled' in res.data) {
        setSettings(res.data);
        setSavedSettings(res.data);
        setHasChanges(false);
        setIsLoading(false);
        return;
      }
    } catch {
      // fallback below
    }

    // Fallback: read from system_settings
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'delivery_settings')
        .maybeSingle();
      if (data?.value && typeof data.value === 'object') {
        const s = { ...DEFAULT_SETTINGS, ...(data.value as Record<string, unknown>) } as DeliverySettings;
        setSettings(s);
        setSavedSettings(s);
      }
    } catch {
      // use defaults
    }
    setHasChanges(false);
    setIsLoading(false);
  }, [callApi]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateField = <K extends keyof DeliverySettings>(key: K, value: DeliverySettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(savedSettings));
      return next;
    });
  };

  const handleSave = async () => {
    const err = validateSettings(settings);
    if (err) { toast.error(err); return; }

    setIsSaving(true);
    try {
      // Save to checkout API
      const res = await callApi({
        path: '/admin/delivery-settings',
        method: 'PUT',
        payload: settings as unknown as Record<string, unknown>,
        showErrorToast: false,
      });

      // Also persist to local system_settings as fallback
      await supabase
        .from('system_settings')
        .upsert({
          key: 'delivery_settings',
          value: settings as unknown as Record<string, unknown>,
          description: 'Delivery fee estimation settings used by checkout system',
        }, { onConflict: 'key' });

      if (res.error) {
        // Saved locally but API failed — warn user
        toast.warning('Saved locally. Checkout API sync failed — settings may not apply to live checkout until API is available.');
      } else {
        toast.success('Delivery settings saved successfully');
      }

      setSavedSettings(settings);
      setHasChanges(false);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading delivery settings..." />;

  const validationError = validateSettings(settings);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Delivery Settings
          </h1>
          <p className="text-muted-foreground">Configure delivery fee estimation for the checkout system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchSettings} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={settings.enabled ? 'border-primary/30 bg-primary/5' : 'border-muted'}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Badge variant={settings.enabled ? 'default' : 'secondary'} className="text-xs">
              {settings.enabled ? 'ENABLED' : 'DISABLED'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {settings.enabled
                ? 'Delivery fee estimation is active in checkout'
                : 'Delivery fee estimation is disabled — checkout will not calculate delivery fees'}
            </span>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => updateField('enabled', v)}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Core Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Core Pricing</CardTitle>
              <CardDescription>Base parameters for delivery fee calculation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="base_fee">Base Fee (TSH)</Label>
                  <Input
                    id="base_fee"
                    type="number"
                    min={0}
                    value={settings.base_fee}
                    onChange={(e) => updateField('base_fee', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_per_km">Price per KM (TSH)</Label>
                  <Input
                    id="price_per_km"
                    type="number"
                    min={0}
                    value={settings.price_per_km}
                    onChange={(e) => updateField('price_per_km', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimum_fee">Minimum Fee (TSH)</Label>
                  <Input
                    id="minimum_fee"
                    type="number"
                    min={0}
                    value={settings.minimum_fee}
                    onChange={(e) => updateField('minimum_fee', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Caps & Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Caps & Limits</CardTitle>
              <CardDescription>Optional limits — leave empty to disable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maximum_fee">Maximum Fee (TSH)</Label>
                  <Input
                    id="maximum_fee"
                    type="number"
                    min={0}
                    placeholder="No cap"
                    value={settings.maximum_fee ?? ''}
                    onChange={(e) => updateField('maximum_fee', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="free_delivery_threshold">Free Delivery Threshold (TSH)</Label>
                  <Input
                    id="free_delivery_threshold"
                    type="number"
                    min={0}
                    placeholder="Disabled"
                    value={settings.free_delivery_threshold ?? ''}
                    onChange={(e) => updateField('free_delivery_threshold', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_delivery_distance_km">Max Distance (KM)</Label>
                  <Input
                    id="max_delivery_distance_km"
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={settings.max_delivery_distance_km ?? ''}
                    onChange={(e) => updateField('max_delivery_distance_km', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Future Extensions Note */}
          <Card className="border-dashed">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Future Extensions</p>
                <p>This module is designed to later support vendor-specific pricing, city/zone-based pricing, platform-managed courier logic, and delivery availability by region. These features are not yet active.</p>
              </div>
            </CardContent>
          </Card>

          {/* Validation Error */}
          {validationError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {validationError}
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving || apiLoading || !!validationError || !hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            {hasChanges && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>

        {/* Sidebar: Formula Preview */}
        <div className="space-y-4">
          <FormulaPreview settings={settings} />
        </div>
      </div>
    </div>
  );
}
