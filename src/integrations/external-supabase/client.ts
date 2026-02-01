/**
 * External Supabase Client
 * 
 * This client connects to the main AfriLink backend (external Supabase)
 * for all data operations (products, orders, users, etc.)
 * 
 * The admin panel uses Lovable Cloud for its own auth/session management,
 * but connects to this external backend for the actual marketplace data.
 */
import { createClient } from '@supabase/supabase-js';

const EXTERNAL_SUPABASE_URL = 'https://ckklirhhwndijsjpmnfe.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNra2xpcmhod25kaWpzanBtbmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMxOTUsImV4cCI6MjA4NTE3OTE5NX0.Z_RwkN3M8q2exVSUUULJBllHB0WXBWpODQcG1-xHaDU';

// Create a client for the external (main AfriLink) backend
export const externalSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'external-supabase-auth',
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

export { EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY };
