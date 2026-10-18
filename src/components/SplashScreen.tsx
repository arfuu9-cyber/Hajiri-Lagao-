import { useEffect, useState } from 'react';
import { useLang } from '@/context/LangContext';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { t } = useLang();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2200);
    const finishTimer = setTimeout(onFinish, 2600);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 ${
        exiting ? 'animate-fade-out' : ''
      }`}
    >
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center mb-8">
        <span className="absolute h-24 w-24 rounded-full bg-saffron-500/20 animate-splash-ring" />
        <span
          className="absolute h-24 w-24 rounded-full bg-saffron-500/15 animate-splash-ring"
          style={{ animationDelay: '0.5s' }}
        />

        {/* Logo with bounce-in */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-saffron-400 to-saffron-600 shadow-2xl shadow-saffron-500/30 ring-1 ring-white/20 animate-splash-logo overflow-hidden">
          <img
            src="/logo.webp"
            alt="Hajiri Lagao"
            className="h-16 w-16 object-contain"
          />
        </div>
      </div>

      {/* App name */}
      <h1 className="text-3xl font-extrabold text-white tracking-tight animate-splash-title">
        {t('appName')}
      </h1>

      {/* Tagline */}
      <p className="mt-3 text-sm text-saffron-300 text-center max-w-xs px-6 animate-splash-subtitle">
        {t('splashTagline')}
      </p>

      {/* Loading bar */}
      <div className="mt-8 h-1.5 w-48 rounded-full bg-navy-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-saffron-400 via-coral-400 to-teal-400 animate-splash-bar"
        />
      </div>
    </div>
  );
}
