import { useState, useRef } from 'react';
import { Phone, MessageSquare, ArrowLeft, ShieldCheck, Zap } from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { PrimaryButton, LangToggle } from '@/components/PrimaryButton';
import { validatePhone } from '@/utils/validation';

type OtpStep = 'phone' | 'otp';

export function LoginScreen() {
  const { sendOtp, verifyOtp, signInWithGoogle } = useAuth();
  const { t } = useLang();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<OtpStep>('phone');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setError(null);
    setPhoneError(null);

    const phoneResult = validatePhone(phone);
    if (!phoneResult.valid) {
      setPhoneError(phoneResult.error ?? 'Invalid phone number');
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtp(phone);
      confirmationRef.current = result;
      setStep('otp');
      startResendTimer();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'OTP bheja nahi ja saka. Dobara try karo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);

    if (otp.trim().length !== 6) {
      setError(t('otpSixDigits'));
      return;
    }

    if (!confirmationRef.current) {
      setError('Session expired. Pehle OTP bhejo.');
      setStep('phone');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(confirmationRef.current, otp, phone);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Galat OTP. Dobara try karo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setLoading(true);
    try {
      const result = await sendOtp(phone);
      confirmationRef.current = result;
      startResendTimer();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'OTP bheja nahi ja saka. Dobara try karo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Google sign-in is not available right now. Please try phone login.';
      setError(message);
      setGoogleLoading(false);
    }
  };

  const resetToPhone = () => {
    setStep('phone');
    setOtp('');
    setError(null);
    setResendTimer(0);
    confirmationRef.current = null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-900 flex flex-col justify-center px-6 py-12">
      {/* reCAPTCHA invisible container */}
      <div id="recaptcha-container" />

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
          <p className="text-sm text-navy-300 mt-1.5 text-center">{t('phoneSignInSubtitle')}</p>

          {/* Feature badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-800/60 px-3 py-1.5 text-xs font-medium text-navy-200 ring-1 ring-navy-700/50">
              <Zap className="h-3.5 w-3.5 text-saffron-400" />
              NFC Haziri
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-800/60 px-3 py-1.5 text-xs font-medium text-navy-200 ring-1 ring-navy-700/50">
              <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
              Firebase OTP
            </span>
          </div>
        </div>

        {step === 'phone' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-navy-200 mb-2">
                {t('mobileNumber')}
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  autoComplete="tel"
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-navy-700 bg-navy-800/80 pl-12 pr-4 py-4 text-base text-white placeholder-navy-400 focus:border-saffron-400 focus:outline-none focus:ring-2 focus:ring-saffron-400/50 transition-all"
                />
              </div>
              {phoneError && (
                <p className="mt-2 text-sm text-red-400">{phoneError}</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-900/40 border border-red-700/50 px-4 py-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <PrimaryButton onClick={handleSendOtp} loading={loading} fullWidth>
              {loading ? t('sendingOtp') : t('sendOtp')}
            </PrimaryButton>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-5">
            <button
              onClick={resetToPhone}
              className="flex items-center gap-1.5 text-sm font-medium text-navy-300 hover:text-navy-100 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('changeNumber')}
            </button>

            <div>
              <label className="block text-sm font-semibold text-navy-200 mb-2">
                {t('enterOtp')}
              </label>
              <p className="text-xs text-navy-400 mb-3">
                {t('otpSentTo')} <span className="font-semibold text-navy-200">{phone}</span>
              </p>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-2xl border border-navy-700 bg-navy-800/80 pl-12 pr-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder-navy-500 focus:border-saffron-400 focus:outline-none focus:ring-2 focus:ring-saffron-400/50 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-900/40 border border-red-700/50 px-4 py-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <PrimaryButton onClick={handleVerifyOtp} loading={loading} fullWidth>
              {loading ? t('verifyingOtp') : t('verifyAndLogin')}
            </PrimaryButton>

            <button
              onClick={handleResendOtp}
              disabled={resendTimer > 0 || loading}
              className="w-full text-center text-sm font-semibold text-saffron-400 hover:text-saffron-300 disabled:text-navy-500 disabled:cursor-not-allowed transition-colors"
            >
              {resendTimer > 0
                ? `${t('resendOtpIn')} ${resendTimer}s`
                : t('resendOtp')}
            </button>
          </div>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-navy-600/60" />
          <span className="text-xs font-medium uppercase tracking-wide text-navy-400">or</span>
          <div className="h-px flex-1 bg-navy-600/60" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
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
          {t('phoneSignInNote')}
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
