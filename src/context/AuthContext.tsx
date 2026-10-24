import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import type { UserProfile, Worker } from '@/types/database';
import { errText } from '@/utils/errors';

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

function chooseWorkerRow(rows: Worker[], role?: UserProfile['role'] | null): Worker | null {
  if (rows.length === 0) return null;
  const rowRole = (worker: Worker) => (worker.role ?? '').trim().toLowerCase();
  if (role === 'thekedar') {
    return rows.find((worker) => rowRole(worker) === 'thekedar' && !worker.thekedar_id)
      ?? rows.find((worker) => rowRole(worker) === 'thekedar')
      ?? rows.find((worker) => !worker.thekedar_id)
      ?? rows[0];
  }
  if (role === 'gatekeeper') {
    return rows.find((worker) => rowRole(worker) === 'gatekeeper' && !worker.thekedar_id)
      ?? rows.find((worker) => rowRole(worker) === 'gatekeeper')
      ?? rows.find((worker) => !worker.thekedar_id)
      ?? rows[0];
  }
  if (role === 'labour') {
    return rows.find((worker) => Boolean(worker.thekedar_id) && !['thekedar', 'gatekeeper'].includes(rowRole(worker)))
      ?? rows.find((worker) => !['thekedar', 'gatekeeper'].includes(rowRole(worker)))
      ?? rows[0];
  }
  return rows[0];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myWorker, setMyWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const loadMyWorker = async (userId: string, role?: UserProfile['role'] | null) => {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as Worker[];
    setMyWorker(chooseWorkerRow(rows, role));
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
    await loadMyWorker(userId, (data as UserProfile | null)?.role ?? null);
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
        const message = errText(err) || 'Login profile load nahi ho saka.';
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
            const message = errText(err) || 'Profile load nahi ho saka.';
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
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setMyWorker(chooseWorkerRow((data ?? []) as Worker[], profile?.role ?? null));
  }, [session?.user?.id, profile?.role]);

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
    const selectedWorker = chooseWorkerRow(rows, (profileData as UserProfile).role);

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
