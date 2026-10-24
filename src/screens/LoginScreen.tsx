import { useState } from 'react';
import { ArrowRight, ClipboardCheck, HardHat, ShieldCheck, WalletCards } from 'lucide-react';
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
      // OAuth should navigate away. If a browser blocks that navigation, unlock the button.
      window.setTimeout(() => setGoogleLoading(false), 12000);
    } catch (err) {
      const message = errText(err) || 'Google sign-in abhi available nahi hai. Dobara try karein.';
      setError(message);
      setGoogleLoading(false);
    } finally {
      if (requestTimer !== undefined) window.clearTimeout(requestTimer);
    }
  };

  const benefits = [
    { icon: ClipboardCheck, title: 'Hajiri', color: 'bg-emerald-100 text-emerald-800' },
    { icon: WalletCards, title: 'Kharchi', color: 'bg-amber-100 text-amber-800' },
    { icon: ShieldCheck, title: 'Safe hisaab', color: 'bg-sky-100 text-sky-800' },
  ];

  return (
    <main className="login-screen">
      <div className="login-screen-orb login-screen-orb-a" aria-hidden="true" />
      <div className="login-screen-orb login-screen-orb-b" aria-hidden="true" />

      <header className="login-topbar">
        <div className="flex min-w-0 items-center gap-3">
          <span className="login-brand-icon"><img src="/app-icon.webp" alt="" /></span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black tracking-tight text-slate-900">{t('appName')}</span>
            <span className="block text-[11px] font-semibold text-slate-500">Site par kaam, ek app mein</span>
          </span>
        </div>
        <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><LangToggle /></div>
      </header>

      <section className="login-content">
        <div className="login-hero-card">
          <span className="login-hero-logo"><img src="/logo.webp" alt="" /></span>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Thekedar · Mazdoor · Hisaab</p>
          <h1 className="mt-2 text-[1.85rem] font-black leading-tight tracking-tight text-white sm:text-4xl">Kaam ka hisaab,<br /><span className="text-amber-300">bilkul aasaan.</span></h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-emerald-50/85">Roz ki haziri, kharchi aur team ka record — sab ek jagah, bina kagaz ke jhanjhat.</p>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 text-xs font-semibold text-white/90">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-emerald-950"><HardHat className="h-4 w-4" /></span>
            <span>Apna Google account use karke surakshit login karein.</span>
          </div>
        </div>

        <div className="login-benefit-row" aria-label="App ke fayde">
          {benefits.map(({ icon: Icon, title, color }) => (
            <div key={title} className="login-benefit-pill">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon className="h-4.5 w-4.5" /></span>
              <span className="text-xs font-extrabold text-slate-700">{title}</span>
            </div>
          ))}
        </div>

        <div className="login-action-card">
          <div className="mb-4">
            <h2 className="text-lg font-black text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Pehli baar ho to account set up hoga. Wahi Gmail dobara use karoge to apna dashboard khulega.</p>
          </div>
          {error && (
            <div role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-800">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="login-google-button flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-extrabold transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500"
          >
            {googleLoading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
            ) : <GoogleIcon />}
            <span>{googleLoading ? 'Google khul raha hai…' : t('continueGoogle')}</span>
            {!googleLoading && <ArrowRight className="ml-auto h-5 w-5 text-emerald-800" />}
          </button>
          <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Google ka secure sign-in use hota hai. App tumhara password store nahi karti.</p>
        </div>
      </section>

      <footer className="login-footer">HAJIRI LAGAO <span>•</span> ROZ KA HISAAB, SAATH-SAATH</footer>
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
