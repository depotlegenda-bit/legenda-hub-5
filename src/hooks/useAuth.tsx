import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';

export type AppRole = 'staff' | 'management' | 'pic' | 'crew' | 'stockman' | 'admin';

const ROLE_PRIORITY: AppRole[] = ['admin', 'management', 'pic', 'stockman', 'staff', 'crew'];

export interface SignUpPayload {
  full_name: string;
  nickname?: string;
  address?: string;
  phone?: string;
  nik?: string;
  outlet_id?: string | null;
  join_month?: string;
  join_year?: string;
  job_title?: string;
  employment_status?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, payload: SignUpPayload) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  session: null,
  user: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: new Error('AuthProvider not ready') }),
  signUp: async () => ({ error: new Error('AuthProvider not ready') }),
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .returns<{ role: AppRole }[]>();

    if (error || !data?.length) {
      setRole('crew');
      return;
    }

    const resolvedRole = ROLE_PRIORITY.find((candidate) =>
      data.some((row) => row.role === candidate)
    ) || 'crew';

    setRole(resolvedRole);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Update session/user sinkron — JANGAN set loading untuk TOKEN_REFRESHED / USER_UPDATED
        // agar tidak memicu flash "Memuat..." dan remount route saat token diperbarui.
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT' || !session?.user) {
          setRole(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setLoading(true);
          setTimeout(async () => {
            await fetchRole(session.user.id);
            setLoading(false);
          }, 0);
        }
        // TOKEN_REFRESHED / USER_UPDATED: biarkan role lama tetap, tidak loading.
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).finally(() => setLoading(false));
        return;
      }
      setRole(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setTimeout(() => logActivity({ module: 'Auth', action: 'Login', description: `Login berhasil (${email})` }), 100);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, payload: SignUpPayload) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: payload.full_name,
          nickname: payload.nickname || '',
          address: payload.address || '',
          phone: payload.phone || '',
          nik: payload.nik || '',
          outlet_id: payload.outlet_id || '',
          join_month: payload.join_month || '',
          join_year: payload.join_year || '',
          job_title: payload.job_title || 'Crew',
          employment_status: payload.employment_status || 'Contract',
        },
      },
    });
    if (!error) {
      setTimeout(() => logActivity({ module: 'Auth', action: 'Sign Up', description: `Pendaftaran akun baru (${email})` }), 100);
    }
    return { error };
  };

  const signOut = async () => {
    await logActivity({ module: 'Auth', action: 'Logout', description: 'Pengguna keluar dari sistem' });
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
