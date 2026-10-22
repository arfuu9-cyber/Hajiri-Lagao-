import { useState, type FormEvent } from 'react';
import { ArrowLeft, User, Phone, HardHat, Users } from 'lucide-react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { useAuth } from '@/context/AuthContext';
import { validateName, validatePhone } from '@/utils/validation';
import { createWorker, claimWorkerByCode } from '@/services/workerService';
import type { UserRole, Worker } from '@/types/database';

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
  const { saveProfile, user, profile, myWorker, reloadMyWorker } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameResult = validateName(name);
    const phoneResult = validatePhone(phone);

    const newErrors: typeof fieldErrors = {};
    if (!nameResult.valid) newErrors.name = nameResult.error;
    if (!phoneResult.valid) newErrors.phone = phoneResult.error;

    setFieldErrors(newErrors);
    if (!role) {
      setRoleError(t('pickRoleFirst'));
    }
    if (!role || Object.keys(newErrors).length > 0) {
      if (!role) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      if (!existingProfile) {
        await saveProfile(role, name);
      }

      const roleName = role === 'thekedar' ? 'Thekedar' : role === 'gatekeeper' ? 'Gatekeeper' : 'Labour';
      let worker: Worker | null = null;
      if (!existingProfile && role === 'labour' && inviteCode.trim()) {
        worker = await claimWorkerByCode(inviteCode);
        if (!worker) throw new Error(t('inviteInvalid'));
      }
      if (!worker) {
        worker = await createWorker({
          name: name.trim(),
          phone: phone.trim(),
          role: roleName,
          daily_wage: 0,
          user_id: existingProfile ? null : user?.id ?? null,
          thekedar_id:
            existingProfile && profile?.role === 'thekedar' && role === 'labour' ? myWorker?.id ?? null : null,
        });
      }

      await reloadMyWorker();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('couldNotSave'));
    } finally {
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t('inviteLabel')}</label>
            <p className="text-xs text-gray-500 mb-2">{t('inviteHint')}</p>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-base font-bold uppercase tracking-[0.3em] focus:border-navy-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('fullName')}</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
