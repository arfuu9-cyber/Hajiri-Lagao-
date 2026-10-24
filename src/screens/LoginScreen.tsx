import { useState } from 'react';
import { ArrowRight, ClipboardCheck, ShieldCheck, WalletCards } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { errText } from '@/utils/errors';
import { LangToggle } from '@/components/PrimaryButton';

export function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const { t } = useLang();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    let requestTimer: number | undefined;
    try {
      await Promise.race([
        signInWithGoogle(),
        new Promise<never>((_, reject) => {
          requestTimer = window.setTimeout(
            () => reject(new Error('Google login shuru nahi ho saka. Internet aur Supabase Google provider settings check karke dobara try karein.')),
            15000,
          );
        }),
      ]);
      // OAuth should navigate away. If the browser blocks that navigation, unlock the button.
      window.setTimeout(() => setGoogleLoading(false), 12000);
    } catch (err) {
      setError(errText(err) || 'Google sign-in abhi available nahi hai. Dobara try karein.');
      setGoogleLoading(false);
    } finally {
      if (requestTimer !== undefined) window.clearTimeout(requestTimer);
    }
  };

  const benefits = [
    { icon: ClipboardCheck, title: 'Roz ki hajiri', color: 'login-feature-green' },
    { icon: WalletCards, title: 'Kharchi ka hisaab', color: 'login-feature-gold' },
    { icon: ShieldCheck, title: 'Apni team safe', color: 'login-feature-blue' },
  ];

  return (
    <main className="login-screen login-screen-v3">
      <div className="login-screen-orb login-screen-orb-a" aria-hidden="true" />
      <div className="login-screen-orb login-screen-orb-b" aria-hidden="true" />

      <header className="login-topbar login-topbar-v3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="login-brand-icon"><img src="/app-icon.webp" alt="" /></span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black tracking-tight text-slate-900">{t('appName')}</span>
            <span className="block text-[11px] font-semibold text-slate-500">Roz ka hisaab, saath-saath</span>
          </span>
        </div>
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><LangToggle /></div>
      </header>

      <section className="login-content login-content-v3">
        <div className="login-welcome-card">
          <div className="login-welcome-mark"><img src="/logo.webp" alt="Hajiri Lagao logo" /></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100">HAJIRI LAGAO</p>
          <h1 className="mt-2 text-[2rem] font-black leading-[1.08] tracking-tight text-white sm:text-4xl">Welcome back<span className="text-amber-300">.</span></h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-emerald-50/90">Apne account mein wapas aayein. Wahi Google account use karein—apna saved role aur dashboard khul jayega.</p>
          <div className="login-welcome-status"><span className="login-status-dot" /> Secure sign-in · No SMS OTP needed</div>
        </div>

        <div className="login-benefit-row login-benefit-row-v3" aria-label="App ke fayde">
          {benefits.map(({ icon: Icon, title, color }) => (
            <div key={title} className="login-benefit-pill login-benefit-pill-v3">
              <span className={`login-feature-icon ${color}`}><Icon className="h-4 w-4" /></span>
              <span className="text-[11px] font-extrabold leading-4 text-slate-700">{title}</span>
            </div>
          ))}
        </div>

        <div className="login-action-card login-action-card-v3">
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-900">Continue with Google</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Pehli baar hain to profile setup hoga. Pehle se account hai to dobara registration ki zaroorat nahi.</p>
          </div>
          {error && (
            <div role="alert" className="mb-3 break-words rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-800">
              {error}
              <button type="button" onClick={() => setError(null)} className="ml-2 font-bold underline">Hatao</button>
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="login-google-button login-google-button-v3 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-extrabold transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500"
          >
            {googleLoading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
            ) : <GoogleIcon />}
            <span>{googleLoading ? 'Google khul raha hai…' : (t('continueGoogle') || 'Google ke saath continue karein')}</span>
            {!googleLoading && <ArrowRight className="ml-auto h-5 w-5 text-emerald-800" />}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-slate-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-700" /> App tumhara Google password store nahi karti.</p>
        </div>
      </section>

      <footer className="login-footer login-footer-v3"><span>HAJIRI LAGAO</span> · ROZ KA HISAAB, SAATH-SAATH</footer>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.9 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
