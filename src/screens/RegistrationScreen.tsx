import { useState, type FormEvent } from 'react';
import { ArrowLeft, User, Phone, HardHat, Users } from 'lucide-react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { useAuth } from '@/context/AuthContext';
import { validateName, validatePhone } from '@/utils/validation';
import { createWorker } from '@/services/workerService';
import { registerLabourWithInviteCode } from '@/services/teamConnectionService';
import { registerAccountWithRole } from '@/services/registrationService';
import type { UserRole } from '@/types/database';

interface RegistrationScreenProps {
  onBack: () => void;
  onSaved: () => void;
  /** true when the logged-in user already has a profile and is registering someone else */
  existingProfile?: boolean;
}

const ROLES: { key: UserRole; icon: typeof HardHat; color: string; bg: string }[] = [
  { key: 'thekedar', icon: HardHat, color: 'text-saffron-600', bg: 'bg-saffron-50' },
  { key: 'labour', icon: Users, color: 'text-navy-600', bg: 'bg-navy-50' },
];

export function RegistrationScreen({ onBack, onSaved, existingProfile = false }: RegistrationScreenProps) {
  const { t } = useLang();
  const { profile, myWorker, reloadProfile } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [thekedarCode, setThekedarCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; thekedarCode?: string }>({});

  const withTimeout = async <T,>(operation: Promise<T>, timeoutMs = 20000): Promise<T> => {
    let timer: number | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = window.setTimeout(
            () => reject(new Error('Server se response nahi mila. Internet check karke dobara try karein.')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setRoleError(null);

    const nameResult = validateName(name);
    const phoneResult = validatePhone(phone);
    const normalizedCode = thekedarCode.trim().toUpperCase();

    const newErrors: typeof fieldErrors = {};
    if (!nameResult.valid) newErrors.name = nameResult.error;
    if (!phoneResult.valid) newErrors.phone = phoneResult.error;
    if (!existingProfile && role === 'labour' && !/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      newErrors.thekedarCode = 'Thekedar ka poora 6-character code daalo (letters/numbers).';
    }

    setFieldErrors(newErrors);
    if (!role) setRoleError(t('pickRoleFirst'));
    if (!role || Object.keys(newErrors).length > 0) {
      if (!role) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      if (!existingProfile && role === 'labour') {
        // Profile + pending team-connection request are saved together by Supabase.
        await withTimeout(registerLabourWithInviteCode({
          displayName: name,
          phone,
          code: normalizedCode,
        }), 25000);
      } else if (!existingProfile) {
        // Thekedar/Gatekeeper profile and own worker row are created atomically.
        // Retrying the same request is safe; the SQL function will not duplicate rows.
        if (role !== 'thekedar' && role !== 'gatekeeper') {
          throw new Error('Selected registration role supported nahi hai.');
        }
        await withTimeout(registerAccountWithRole({
          displayName: name,
          phone,
          role,
        }), 25000);
      } else {
        // Existing thekedar adding a team member; account profile is not modified.
        const roleName = role === 'thekedar' ? 'Thekedar' : role === 'gatekeeper' ? 'Gatekeeper' : 'Labour';
        await withTimeout(createWorker({
          name: name.trim(),
          phone: phone.trim(),
          role: roleName,
          daily_wage: 0,
          user_id: null,
          thekedar_id:
            profile?.role === 'thekedar' && role === 'labour' ? myWorker?.id ?? null : null,
        }), 25000);
      }

      // A successful atomic save can safely be retried if profile refresh times out.
      // Keep a visible error and release the button instead of trapping the user in a spinner.
      try {
        await withTimeout(reloadProfile(), 10000);
      } catch (refreshError) {
        const detail = refreshError instanceof Error ? ` Details: ${refreshError.message}` : '';
        throw new Error(`Registration request save ho sakti hai, lekin profile refresh nahi hui.${detail} Internet aur Supabase project URL verify karke Submit dobara karein — retry-safe registration duplicate row nahi banani chahiye.`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('couldNotSave'));
    } finally {
      // Always unlock the submit button after validation, success, server errors or timeout.
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('newRegistration')}</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-5 py-6 max-w-2xl mx-auto space-y-5">
        {/* Role Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {existingProfile ? t('selectPersonRole') : t('selectYourRole')}
          </label>
          {!existingProfile && (
            <p className="text-xs text-gray-500 mb-3">{t('roleIntro')}</p>
          )}
          <div className="space-y-3">
            {ROLES.map(({ key, icon: Icon, color, bg }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setRole(key);
                  setRoleError(null);
                }}
                className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                  role === key
                    ? 'border-navy-600 bg-navy-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-base font-semibold ${role === key ? 'text-navy-900' : 'text-gray-800'}`}>
                    {t(`role_${key}`)}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{t(`roleDesc_${key}`)}</p>
                </div>
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    role === key ? 'border-navy-600 bg-navy-600' : 'border-gray-300'
                  }`}
                >
                  {role === key && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              </button>
            ))}
          </div>
          {roleError && <p className="mt-2 text-sm text-red-600">{roleError}</p>}
        </div>

        {!existingProfile && role === 'labour' && (
          <div className="space-y-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-900">Thekedar se verified connection</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">Apne Thekedar ke worker profile par diya gaya 6-character invite code yahan daalein. Request usi Thekedar ko jayegi; approve hone ke baad hi hajiri aur kharchi link hongi.</p>
            </div>
            <div>
              <label htmlFor="thekedar-code" className="mb-2 block text-sm font-semibold text-gray-700">
                Thekedar ka code (6-character invite code) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <HardHat className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="thekedar-code"
                  name="thekedarCode"
                  type="text"
                  value={thekedarCode}
                  onChange={(event) => {
                    const cleaned = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                    setThekedarCode(cleaned);
                    if (fieldErrors.thekedarCode) setFieldErrors((current) => ({ ...current, thekedarCode: undefined }));
                  }}
                  placeholder="Example: A1B2C3"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={6}
                  minLength={6}
                  pattern="[A-Za-z0-9]{6}"
                  required={!existingProfile && role === 'labour'}
                  aria-invalid={Boolean(fieldErrors.thekedarCode)}
                  aria-describedby={fieldErrors.thekedarCode ? 'thekedar-code-error' : 'thekedar-code-help'}
                  className="w-full rounded-xl border border-emerald-300 bg-white py-3.5 pl-11 pr-4 text-base font-bold uppercase tracking-[0.25em] text-gray-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p id="thekedar-code-help" className="mt-1.5 text-xs text-gray-500">Code letters ya numbers ka ho sakta hai. Spaces automatically remove ho jayengi.</p>
              {fieldErrors.thekedarCode && <p id="thekedar-code-error" role="alert" className="mt-1.5 text-sm text-red-600">{fieldErrors.thekedarCode}</p>}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('fullName')}</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined })); }}
              placeholder="e.g. Ramesh Kumar"
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          {fieldErrors.name && <p className="mt-1.5 text-sm text-red-600">{fieldErrors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('phoneNumber')}</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (fieldErrors.phone) setFieldErrors((current) => ({ ...current, phone: undefined })); }}
              placeholder="e.g. 98765 43210"
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          {fieldErrors.phone && <p className="mt-1.5 text-sm text-red-600">{fieldErrors.phone}</p>}
        </div>


        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="pt-2">
          <PrimaryButton type="submit" loading={loading} fullWidth>
            {loading ? t('saving') : t('submitRegistration')}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
