/**
 * External Auth Context
 * 
 * Manages authentication with the external AfriLink backend.
 * This is separate from the Lovable Cloud auth used for the admin panel itself.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { externalSupabase } from '@/integrations/external-supabase/client';
import type { AdminUser, AppRole } from '@/lib/types';

interface ExternalAuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const ExternalAuthContext = createContext<ExternalAuthContextType | undefined>(undefined);

export function ExternalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cache whether the external DB has the is_active column
  const adminUsersHasIsActiveRef = useRef<boolean | null>(null);

  const fetchAdminUser = useCallback(async (userId: string) => {
    try {
      const shouldFilterActive = adminUsersHasIsActiveRef.current !== false;
      
      let query = externalSupabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

      if (shouldFilterActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        // If the backend doesn't have `is_active`, retry once without it.
        if ((error as any)?.code === '42703' && shouldFilterActive) {
          adminUsersHasIsActiveRef.current = false;
          const { data: fallbackData, error: fallbackError } = await externalSupabase
            .from('admin_users')
            .select('*')
            .eq('user_id', userId)
            .limit(1);

          if (fallbackError) {
            console.error('[ExternalAuth] Error fetching admin user (fallback):', fallbackError);
            setAdminUser(null);
            return;
          }

          const adminRecord = fallbackData?.[0] ?? null;
          setAdminUser(adminRecord as AdminUser | null);
          return;
        }

        console.error('[ExternalAuth] Error fetching admin user:', error);
        setAdminUser(null);
        return;
      }

      if (adminUsersHasIsActiveRef.current === null && shouldFilterActive) {
        adminUsersHasIsActiveRef.current = true;
      }

      const adminRecord = data?.[0] ?? null;
      setAdminUser(adminRecord as AdminUser | null);
    } catch (err) {
      console.error('[ExternalAuth] Error in fetchAdminUser:', err);
      setAdminUser(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[ExternalAuth] Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchAdminUser(session.user.id);
          }, 0);
        } else {
          setAdminUser(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    externalSupabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[ExternalAuth] Initial session check:', session ? 'found' : 'none');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchAdminUser(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchAdminUser]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[ExternalAuth] Signing in to external backend...');
      const { error } = await externalSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[ExternalAuth] Sign in error:', error);
        return { error };
      }

      console.log('[ExternalAuth] Sign in successful');
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await externalSupabase.auth.signOut();
    setAdminUser(null);
  };

  const hasRole = (role: AppRole): boolean => {
    return adminUser?.role === role;
  };

  const value: ExternalAuthContextType = {
    user,
    session,
    adminUser,
    isLoading,
    isAuthenticated: !!session,
    isAdmin: !!adminUser,
    isSuperAdmin: adminUser?.role === 'SUPER_ADMIN',
    hasRole,
    signIn,
    signOut,
  };

  return <ExternalAuthContext.Provider value={value}>{children}</ExternalAuthContext.Provider>;
}

export function useExternalAuth() {
  const context = useContext(ExternalAuthContext);
  if (context === undefined) {
    throw new Error('useExternalAuth must be used within an ExternalAuthProvider');
  }
  return context;
}
