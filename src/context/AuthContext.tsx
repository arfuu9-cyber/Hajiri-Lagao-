import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { supabase } from '@/services/supabase';
import { getFirebaseAuth } from '@/services/firebase';
import type { UserProfile, UserRole } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<ConfirmationResult>;
  verifyOtp: (confirmationResult: ConfirmationResult, otp: string, phone: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (role: UserRole, displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getRecaptcha = (): RecaptchaVerifier => {
    if (!recaptchaVerifier) {
      const auth = getFirebaseAuth();
      recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
      });
    }
    return recaptchaVerifier;
  };

  const sendOtp = async (phone: string): Promise<ConfirmationResult> => {
    const formatted = formatPhone(phone);
    const auth = getFirebaseAuth();
    const verifier = getRecaptcha();
    return await signInWithPhoneNumber(auth, formatted, verifier);
  };

  const verifyOtp = async (confirmationResult: ConfirmationResult, otp: string, phone: string) => {
    await confirmationResult.confirm(otp);
    const formattedPhone = formatPhone(phone);

    const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-firebase`;
    const resp = await fetch(funcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone: formattedPhone }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error ?? 'Supabase login nahi ho saka.');
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (setSessionError) throw setSessionError;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw error;
  };

  const saveProfile = async (role: UserRole, displayName: string) => {
    if (!session?.user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: session.user.id,
        phone: session.user.phone ?? null,
        display_name: displayName.trim() || null,
        role,
      })
      .select()
      .single();

    if (error) throw error;
    setProfile(data as UserProfile);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    recaptchaVerifier?.clear();
    recaptchaVerifier = null;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        sendOtp,
        verifyOtp,
        signInWithGoogle,
        signOut,
        saveProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function formatPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  return `+91${trimmed.replace(/^0+/, '')}`;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
