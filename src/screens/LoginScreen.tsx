import { useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, HardHat, ShieldCheck, WalletCards } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
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
      const message = err instanceof Error ? err.message : 'Google sign-in abhi available nahi hai. Dobara try karein.';
      setError(message);
      setGoogleLoading(false);
    } finally {
      if (requestTimer !== undefined) window.clearTimeout(requestTimer);
    }
  };

  const benefits = [
    { icon: ClipboardList, title: 'Roz ki haziri', description: 'Attendance aur approval ka saaf record', color: 'bg-emerald-100 text-emerald-800' },
    { icon: WalletCards, title: 'Kamai aur kharchi', description: 'Dihadi, advance aur payment ek jagah', color: 'bg-amber-100 text-amber-800' },
    { icon: ShieldCheck, title: 'App ke andar confirmation', description: 'Kharchi ko Mazdoor apne account se confirm kare', color: 'bg-sky-100 text-sky-800' },
  ];

  return (
    <main className="login-shell relative isolate flex min-h-[100svh] flex-col overflow-hidden px-4 py-5 sm:px-6 sm:py-8">
      <div className="login-orb login-orb-one pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full" />
      <div className="login-orb login-orb-two pointer-events-none absolute -bottom-32 -left-24 -z-10 h-80 w-80 rounded-full" />

      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-amber-400 shadow-lg shadow-amber-950/20 ring-1 ring-white/25">
            <img src="/logo.webp" alt="" className="h-9 w-9 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold tracking-tight text-white">{t('appName')}</p>
            <p className="text-[11px] font-medium text-emerald-100/75">Site ka kaam, ek app mein</p>
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-white/15 bg-white/5 p-1">
          <LangToggle />
        </div>
      </header>

      <section className="mx-auto my-auto w-full max-w-md py-8">
        <div className="mb-6 text-center sm:mb-7">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/15 bg-white/10 text-emerald-50 shadow-xl shadow-black/10 backdrop-blur-sm">
            <HardHat className="h-8 w-8" strokeWidth={1.8} />
          </span>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-200">Kaam ka hisaab, bilkul aasaan</p>
          <h1 className="text-[2rem] font-black leading-tight tracking-tight text-white sm:text-4xl">{t('appName')}</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-emerald-100/80">Apni haziri, kamai aur team ka record kabhi bhi dekhein.</p>
        </div>

        <div className="space-y-3">
          {benefits.map(({ icon: Icon, title, description, color }, index) => (
            <div key={title} className="login-benefit-card flex items-center gap-3 rounded-2xl p-3.5 sm:p-4" style={{ animationDelay: `${index * 70}ms` }}>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" strokeWidth={2} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-white">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-emerald-100/70">{description}</span>
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300/75" />
            </div>
          ))}
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-950/40 px-4 py-3 text-sm leading-5 text-rose-100">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="login-google-button mt-5 flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-extrabold transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        >
          {googleLoading ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
          ) : (
            <GoogleIcon />
          )}
          <span>{googleLoading ? 'Google se connect ho raha hai…' : t('continueGoogle')}</span>
          {!googleLoading && <ArrowRight className="ml-auto h-5 w-5 text-emerald-800" />}
        </button>

        <p className="mx-auto mt-4 max-w-xs text-center text-[11px] leading-5 text-emerald-100/60">
          Secure login ke liye apna Google account use karein. Pehli baar role aur profile save karein; agli baar wahi account use karein.
        </p>
      </section>

      <footer className="mx-auto w-full max-w-md pb-1 text-center text-[10px] font-medium tracking-wide text-emerald-100/40">HAJIRI LAGAO · TEAM · ATTENDANCE · HISAAB</footer>
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
