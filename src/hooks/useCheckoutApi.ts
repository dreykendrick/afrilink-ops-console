import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CheckoutApiOptions {
  path: string;
  method?: string;
  payload?: Record<string, unknown>;
  queryParams?: Record<string, string | number | boolean | undefined>;
  showErrorToast?: boolean;
}

export function useCheckoutApi() {
  const [isLoading, setIsLoading] = useState(false);

  const callApi = useCallback(async <T = unknown>({
    path,
    method = 'GET',
    payload,
    queryParams,
    showErrorToast = true,
  }: CheckoutApiOptions): Promise<{ data: T | null; error: string | null }> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('checkout-admin-proxy', {
        body: { path, method, payload, queryParams },
      });

      if (error) {
        const msg = error.message || 'API call failed';
        if (showErrorToast) toast({ title: 'Error', description: msg, variant: 'destructive' });
        return { data: null, error: msg };
      }

      if (data?.error) {
        const msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        if (showErrorToast) toast({ title: 'Error', description: msg, variant: 'destructive' });
        return { data: null, error: msg };
      }

      return { data: data as T, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      if (showErrorToast) toast({ title: 'Error', description: msg, variant: 'destructive' });
      return { data: null, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { callApi, isLoading };
}
