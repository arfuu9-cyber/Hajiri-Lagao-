import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import type { UserProfile, UserRole, Worker } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  myWorker: Worker | null;
  reloadMyWorker: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (role: UserRole, displayName: string, phone?: string) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myWorker, setMyWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMyWorker = async (userId: string) => {
    const { data } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as Worker[];
    // Prefer the row that is connected to a thekedar, not an old unassigned profile row.
    const selected = rows.find((worker) => Boolean(worker.thekedar_id)) ?? rows[0] ?? null;
    setMyWorker(selected);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as UserProfile);
    } else {
      setProfile(null);
    }
    await loadMyWorker(userId);
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setMyWorker(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw error;
  };

  const saveProfile = async (role: UserRole, displayName: string, phone?: string) => {
    if (!session?.user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: session.user.id,
        phone: phone?.trim() || session.user.phone || null,
        display_name: displayName.trim() || null,
        role,
      })
      .select()
      .single();

    if (error) throw error;
    // Keep the registration screen mounted until its related worker setup has completed.
    // RegistrationScreen calls reloadProfile() after it has safely finished.
    return data as UserProfile;
  };

  const reloadMyWorker = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as Worker[];
    setMyWorker(rows.find((worker) => Boolean(worker.thekedar_id)) ?? rows[0] ?? null);
  }, [session?.user?.id]);

  const reloadProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setMyWorker(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        myWorker,
        reloadMyWorker,
        reloadProfile,
        loading,
        signInWithGoogle,
        signOut,
        saveProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/** A thekedar sees only his own team; everyone else gets undefined (no filter). */
// eslint-disable-next-line react-refresh/only-export-components
export function useTeamId(): string | undefined {
  const { profile, myWorker } = useAuth();
  return profile?.role === 'thekedar' ? myWorker?.id : undefined;
}
