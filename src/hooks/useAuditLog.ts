import { useCallback } from 'react';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { useExternalAuth } from '@/contexts/ExternalAuthContext';
import type { Json } from '@/integrations/supabase/types';

interface AuditLogParams {
  actionType: string;
  entityType: string;
  entityId?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  reason?: string;
}

export function useAuditLog() {
  const { adminUser } = useExternalAuth();

  const createAuditLog = useCallback(async ({
    actionType,
    entityType,
    entityId,
    beforeData,
    afterData,
    reason,
  }: AuditLogParams) => {
    if (!adminUser) {
      console.warn('Cannot create audit log: No admin user');
      return;
    }

    try {
      const { error } = await externalSupabase.from('audit_logs').insert({
        admin_user_id: adminUser.id,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId ?? null,
        before_data: beforeData as Json ?? null,
        after_data: afterData as Json ?? null,
        reason: reason ?? null,
      });

      if (error) {
        console.error('Failed to create audit log:', error);
      }
    } catch (err) {
      console.error('Error creating audit log:', err);
    }
  }, [adminUser]);

  return { createAuditLog };
}
