import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AdminUser, AppRole } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Some environments may not have the `admin_users.is_active` column yet.
  // Cache that fact so we don't spam failing requests.
  const adminUsersHasIsActiveRef = useRef<boolean | null>(null);

  const fetchAdminUser = useCallback(async (userId: string) => {
    try {
      const baseQuery = supabase.from('admin_users').select('*').eq('user_id', userId);

      const shouldFilterActive = adminUsersHasIsActiveRef.current !== false;
      const primaryQuery = shouldFilterActive ? baseQuery.eq('is_active', true) : baseQuery;

      const { data, error } = await primaryQuery.maybeSingle();

      if (error) {
        // If the backend doesn't have `is_active`, retry once without it.
        if ((error as any)?.code === '42703' && shouldFilterActive) {
          adminUsersHasIsActiveRef.current = false;
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (fallbackError) {
            console.error('Error fetching admin user (fallback):', fallbackError);
            setAdminUser(null);
            return;
          }

          setAdminUser((fallbackData as AdminUser) ?? null);
          return;
        }

        console.error('Error fetching admin user:', error);
        setAdminUser(null);
        return;
      }

      // Cache that `is_active` exists if we successfully queried using it.
      if (adminUsersHasIsActiveRef.current === null && shouldFilterActive) {
        adminUsersHasIsActiveRef.current = true;
      }

      setAdminUser((data as AdminUser) ?? null);
    } catch (err) {
      console.error('Error in fetchAdminUser:', err);
      setAdminUser(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer admin user fetch with setTimeout
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
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
  };

  const hasRole = (role: AppRole): boolean => {
    return adminUser?.role === role;
  };

  const value: AuthContextType = {
    user,
    session,
    adminUser,
    isLoading,
    isAdmin: !!adminUser,
    isSuperAdmin: adminUser?.role === 'SUPER_ADMIN',
    hasRole,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
