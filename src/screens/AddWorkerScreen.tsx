import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, User, Phone, Briefcase, IndianRupee, Camera, X, Image as ImageIcon } from 'lucide-react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { useAuth } from '@/context/AuthContext';
import { validateName, validatePhone, validateRole, WORKER_ROLES } from '@/utils/validation';
import { createWorker, uploadWorkerPhoto } from '@/services/workerService';

interface AddWorkerScreenProps {
  onBack: () => void;
  onSaved: () => void;
  initialRole?: string;
}

export function AddWorkerScreen({ onBack, onSaved, initialRole = '' }: AddWorkerScreenProps) {
  const { t } = useLang();
  const { profile, myWorker } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(initialRole);
  const [customRole, setCustomRole] = useState('');
  const [useCustomRole, setUseCustomRole] = useState(false);
  const [dailyWage, setDailyWage] = useState('');
  const [age, setAge] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    role?: string;
    dailyWage?: string;
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setPhotoBlob(file);
  };

  const clearPhoto = () => {
    setPhotoDataUrl(null);
    setPhotoBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalRole = useCustomRole ? customRole : role;
    const nameResult = validateName(name);
    const phoneResult = validatePhone(phone);
    const roleResult = validateRole(finalRole);
    const wage = Number(dailyWage);
    const wageValid = dailyWage.trim().length > 0 && Number.isFinite(wage) && wage >= 0;

    const newErrors: typeof fieldErrors = {};
    if (!nameResult.valid) newErrors.name = nameResult.error;
    if (!phoneResult.valid) newErrors.phone = phoneResult.error;
    if (!roleResult.valid) newErrors.role = roleResult.error;
    if (!wageValid) newErrors.dailyWage = t('enterValidWage');

    setFieldErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const ageNum = age.trim() ? Number(age) : null;
    if (ageNum !== null && (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120)) {
      setError(t('enterValidAge'));
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | null = null;

      if (photoBlob) {
        setUploadingPhoto(true);
        try {
          photoUrl = await uploadWorkerPhoto(photoBlob, name.trim());
        } catch {
          // Photo upload failure should not block worker creation
          photoUrl = null;
        } finally {
          setUploadingPhoto(false);
        }
      }

      await createWorker({
        name: name.trim(),
        phone: phone.trim(),
        role: finalRole.trim(),
        daily_wage: wage,
        age: ageNum,
        profile_photo_url: photoUrl,
        thekedar_id: profile?.role === 'thekedar' ? myWorker?.id ?? null : null,
      });
      onSaved();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('couldNotSave');
      setError(message);
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
          <h1 className="text-lg font-bold text-gray-900">{t('addNewWorkerTitle')}</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-5 py-6 max-w-2xl mx-auto space-y-5">
        {/* Photo capture */}
        <div className="flex flex-col items-center gap-3">
          {photoDataUrl ? (
            <div className="relative">
              <img
                src={photoDataUrl}
                alt="Worker preview"
                className="h-28 w-28 rounded-full object-cover border-4 border-white shadow-md"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gray-100 border-2 border-dashed border-gray-300">
              <User className="h-10 w-10 text-gray-400" />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
            >
              <Camera className="h-4 w-4" /> {t('takePhoto')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <ImageIcon className="h-4 w-4" /> {t('choosePhoto')}
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handlePhotoSelected}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelected}
            className="hidden"
          />
          <p className="text-xs text-gray-400">{t('photoOptional')}</p>
        </div>

        {/* Name */}
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

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('phoneNumber')}</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +919876543210"
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          {fieldErrors.phone && (
            <p className="mt-1.5 text-sm text-red-600">{fieldErrors.phone}</p>
          )}
        </div>

        {/* Age (optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t('ageLabel')} <span className="text-gray-400 font-normal">({t('optional')})</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="number"
              min="0"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 25"
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          {age && Number(age) > 0 && Number(age) < 18 && (
            <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              {t('under18Warning')}
            </p>
          )}
        </div>

        {/* Daily wage */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('dailyWageRate')}</label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={dailyWage}
              onChange={(e) => setDailyWage(e.target.value)}
              placeholder="e.g. 700"
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          {fieldErrors.dailyWage && (
            <p className="mt-1.5 text-sm text-red-600">{fieldErrors.dailyWage}</p>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('workerRole')}</label>
          {!useCustomRole ? (
            <>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 bg-white focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500 appearance-none"
                >
                  <option value="">{t('selectRole')}</option>
                  {WORKER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setUseCustomRole(true)}
                className="mt-2 text-sm font-medium text-navy-600 hover:text-navy-700"
              >
                {t('enterCustomRole')}
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Foreman"
                  className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseCustomRole(false);
                  setCustomRole('');
                }}
                className="mt-2 text-sm font-medium text-navy-600 hover:text-navy-700"
              >
                {t('chooseFromList')}
              </button>
            </>
          )}
          {fieldErrors.role && (
            <p className="mt-1.5 text-sm text-red-600">{fieldErrors.role}</p>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="pt-2">
          <PrimaryButton type="submit" loading={loading || uploadingPhoto} fullWidth>
            {loading ? t('saving') : uploadingPhoto ? t('uploadingPhoto') : t('saveWorker')}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
