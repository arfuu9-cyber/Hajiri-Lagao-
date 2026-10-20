import { useState, type FormEvent } from 'react';
import { ArrowLeft, User, Phone, CreditCard, Camera, Image as ImageIcon, HardHat, Users, ShieldCheck } from 'lucide-react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useLang } from '@/context/LangContext';
import { useAuth } from '@/context/AuthContext';
import { validateName, validatePhone } from '@/utils/validation';
import { supabase } from '@/services/supabase';
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
  { key: 'labour', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
];

export function RegistrationScreen({ onBack, onSaved, existingProfile = false }: RegistrationScreenProps) {
  const { t } = useLang();
  const { saveProfile, user, profile, myWorker, reloadMyWorker } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; aadhaar?: string }>({});

  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const openCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setStream(mediaStream);
      setCameraOpen(true);
    } catch {
      setError(t('cameraError'));
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhotoDataUrl(dataUrl);
    closeCamera();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameResult = validateName(name);
    const phoneResult = validatePhone(phone);
    const aadhaarDigits = aadhaar.replace(/\s/g, '');

    const newErrors: typeof fieldErrors = {};
    if (!nameResult.valid) newErrors.name = nameResult.error;
    if (!phoneResult.valid) newErrors.phone = phoneResult.error;
    if (aadhaarDigits.length !== 12) newErrors.aadhaar = t('aadhaarError');

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

      let photoUrl: string | null = null;

      if (photoDataUrl) {
        const fileName = `aadhaar_${worker.id}_${Date.now()}.jpg`;
        const base64 = photoDataUrl.split(',')[1];
        const blob = base64ToBlob(base64, 'image/jpeg');
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('worker-id-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg' });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('worker-id-photos')
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      await supabase
        .from('workers')
        .update({
          aadhaar_number: aadhaarDigits,
          id_photo_url: photoUrl,
        })
        .eq('id', worker.id);

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
            onClick={() => { closeCamera(); onBack(); }}
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('aadhaarNumber')}</label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={aadhaar}
              onChange={(e) => setAadhaar(formatAadhaar(e.target.value))}
              placeholder="XXXX XXXX XXXX"
              inputMode="numeric"
              className="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          {fieldErrors.aadhaar && <p className="mt-1.5 text-sm text-red-600">{fieldErrors.aadhaar}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">{t('captureIdCard')}</label>

          {cameraOpen && (
            <div className="rounded-xl border border-gray-300 overflow-hidden">
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                className="w-full"
                onLoadedMetadata={() => {
                  if (stream && videoRef) videoRef.srcObject = stream;
                }}
              />
              <div className="flex gap-3 p-3 bg-gray-50">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-navy-700 py-3 text-sm font-semibold text-white hover:bg-navy-600 transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  {t('capture')}
                </button>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {!cameraOpen && (
            <button
              type="button"
              onClick={openCamera}
              className="w-full flex items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-5 hover:border-navy-400 transition-colors text-left"
            >
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="ID" className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{t('captureId')}</p>
                <p className="text-sm text-gray-500">{t('captureIdDesc')}</p>
              </div>
            </button>
          )}

          {photoDataUrl && !cameraOpen && (
            <button
              type="button"
              onClick={() => setPhotoDataUrl(null)}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
            >
              {t('removePhoto')}
            </button>
          )}
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

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mimeType });
}
