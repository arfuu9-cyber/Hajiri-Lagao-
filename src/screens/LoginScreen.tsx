import { useState } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { LangToggle } from '@/components/PrimaryButton';

export function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const { t } = useLang();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Google sign-in abhi available nahi hai. Dobara try karo.';
      setError(message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-900 flex flex-col justify-center px-6 py-12">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-saffron-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-navy-500/10 blur-3xl" />

      <div className="relative w-full max-w-sm mx-auto">
        <div className="flex justify-end mb-6">
          <LangToggle />
        </div>

        {/* Logo + Branding */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <span className="absolute inset-0 rounded-3xl bg-saffron-500/20 animate-splash-ring" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-saffron-400 to-saffron-600 shadow-2xl shadow-saffron-500/40 ring-1 ring-white/20">
              <img
                src="/logo.webp"
                alt="Hajiri Lagao"
                className="h-12 w-12 object-contain"
              />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{t('appName')}</h1>
          <p className="text-sm text-navy-300 mt-1.5 text-center">{t('googleSignInSubtitle')}</p>

          {/* Feature badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-800/60 px-3 py-1.5 text-xs font-medium text-navy-200 ring-1 ring-navy-700/50">
              <Zap className="h-3.5 w-3.5 text-saffron-400" />
              NFC Haziri
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-800/60 px-3 py-1.5 text-xs font-medium text-navy-200 ring-1 ring-navy-700/50">
              <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
              {t('secureLogin')}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-900/40 border border-red-700/50 px-4 py-3">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-navy-600/60 bg-navy-800/60 px-6 py-4 text-base font-semibold text-white transition-all hover:bg-navy-700/60 hover:border-navy-500 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-saffron-400/50"
        >
          {googleLoading ? (
            <svg className="h-5 w-5 animate-spin text-saffron-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <GoogleIcon />
          )}
          {googleLoading ? t('connectingGoogle') : t('continueGoogle')}
        </button>

        <p className="mt-5 text-center text-xs text-navy-400">
          {t('googleSignInNote')}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
