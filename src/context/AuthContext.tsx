import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import type { UserProfile, Worker } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  myWorker: Worker | null;
  reloadMyWorker: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  loading: boolean;
  profileLoadError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myWorker, setMyWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

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

    if (error) {
      setProfile(null);
      setProfileLoadError(`Profile load nahi ho saka: ${error.message}`);
    } else {
      setProfileLoadError(null);
      setProfile((data as UserProfile | null) ?? null);
    }
    await loadMyWorker(userId);
  };

  useEffect(() => {
    let initialLoadTimer: number | undefined;
    const initialLoadTimeout = new Promise<never>((_, reject) => {
      initialLoadTimer = window.setTimeout(
        () => reject(new Error('Session/profile load timeout')),
        15000,
      );
    });

    Promise.race([
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        setSession(session);
        if (session?.user) await fetchProfile(session.user.id);
      }),
      initialLoadTimeout,
    ])
      .catch((err: unknown) => {
        // Never route a session/profile query failure into registration, which could
        // make an existing account look like a new user. Show a retry screen instead.
        const message = err instanceof Error ? err.message : 'Login profile load nahi ho saka.';
        setProfileLoadError(message);
      })
      .finally(() => {
        if (initialLoadTimer !== undefined) window.clearTimeout(initialLoadTimer);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      // The INITIAL_SESSION path is loaded above and awaits the profile query.
      // Token refresh must not remount the registration screen or flash a loader.
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

      if (!nextSession?.user) {
        setProfile(null);
        setProfileLoadError(null);
        setMyWorker(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
        setLoading(true);
        let profileTimer: number | undefined;
        const timeout = new Promise<never>((_, reject) => {
          profileTimer = window.setTimeout(
            () => reject(new Error('Profile load timeout')),
            15000,
          );
        });
        Promise.race([fetchProfile(nextSession.user.id), timeout])
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'Profile load nahi ho saka.';
            setProfileLoadError(message);
          })
          .finally(() => {
            if (profileTimer !== undefined) window.clearTimeout(profileTimer);
            setLoading(false);
          });
        return;
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (initialLoadTimer !== undefined) window.clearTimeout(initialLoadTimer);
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
    const userId = session?.user?.id;
    if (!userId) throw new Error('Login session nahi mili. Dobara sign in karein.');

    setProfileLoadError(null);
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      setProfileLoadError(`Profile refresh failed: ${profileError.message}`);
      throw new Error(`Profile refresh failed: ${profileError.message}`);
    }
    if (!profileData) {
      setProfileLoadError(null);
      setProfile(null);
      throw new Error('Saved profile database se nahi mili. Naya profile setup dikhaya jayega.');
    }

    const { data: workerRows, error: workerError } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (workerError) {
      setProfileLoadError(`Team profile refresh failed: ${workerError.message}`);
      throw new Error(`Team profile refresh failed: ${workerError.message}`);
    }
    const rows = (workerRows ?? []) as Worker[];
    const selectedWorker = rows.find((worker) => Boolean(worker.thekedar_id)) ?? rows[0] ?? null;

    if ((profileData.role === 'thekedar' || profileData.role === 'gatekeeper') && !selectedWorker) {
      const message = 'Account profile mil gaya, lekin Thekedar/Gatekeeper worker record nahi mila. Support/DB setup check karein; dobara account register na karein.';
      setProfileLoadError(message);
      throw new Error(message);
    }

    setProfileLoadError(null);
    setProfile(profileData as UserProfile);
    setMyWorker(selectedWorker);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileLoadError(null);
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
        profileLoadError,
        signInWithGoogle,
        signOut,
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
