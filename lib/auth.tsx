import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../integrations/supabase/client';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  is_active?: boolean;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  currentUserRole: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setRole: (role: string) => void;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<UseAuthReturn | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      // profiles.is_active does not exist in the current Supabase schema.
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  const loadUserRole = async (userId: string) => {
    try {
      const profile = await fetchUserProfile(userId);

      if (profile?.role) {
        setCurrentUserRole(profile.role as string);
      } else {
        setCurrentUserRole(null);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const refreshRole = async () => {
    if (!user) return;
    await loadUserRole(user.id);
  };

  const setRole = (role: string) => {
    setCurrentUserRole(role);
    localStorage.setItem('selectedRole', role);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const userData: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || '',
          };
          setUser(userData);
          await loadUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userData: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || '',
        };
        setUser(userData);
        await loadUserRole(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCurrentUserRole(null);
        localStorage.removeItem('selectedRole');
        localStorage.removeItem('userId');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: UseAuthReturn = {
    user,
    currentUserRole,
    isAuthenticated: !!user,
    isLoading,
    setRole,
    refreshRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
