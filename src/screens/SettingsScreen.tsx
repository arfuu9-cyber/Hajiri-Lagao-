import { useState } from 'react';
import {
  ArrowLeft,
  HelpCircle,
  DatabaseBackup,
  Headphones,
  Info,
  LogOut,
  Globe,
  ChevronRight,
  Phone,
  Mail,
  MessageCircle,
  Shield,
  FileText,
  CheckCircle2,
  HardHat,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang, type Lang } from '@/context/LangContext';
import { LangToggle } from '@/components/PrimaryButton';
import { fetchWorkers } from '@/services/workerService';
import { fetchAttendanceHistory } from '@/services/attendanceService';
import { fetchRecentAdvances } from '@/services/payrollService';

interface SettingsScreenProps {
  onBack: () => void;
}

type SubPage = 'main' | 'faq' | 'backup' | 'support' | 'about';

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { signOut, user } = useAuth();
  const { t, lang, setLang } = useLang();
  const [subPage, setSubPage] = useState<SubPage>('main');

  const handleSignOut = async () => {
    await signOut();
  };

  const goBack = () => {
    if (subPage === 'main') {
      onBack();
    } else {
      setSubPage('main');
    }
  };

  const titleMap: Record<SubPage, string> = {
    main: t('settings'),
    faq: t('faq'),
    backup: t('backup'),
    support: t('contactSupport'),
    about: t('about'),
  };

  return (
    <div className="min-h-screen bg-concrete-50">
      <header className="bg-gradient-to-r from-navy-700 to-navy-900 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-navy-200 hover:bg-navy-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{titleMap[subPage]}</h1>
            {subPage === 'main' && (
              <p className="text-xs text-navy-300">{t('settingsSubtitle')}</p>
            )}
          </div>
        </div>
      </header>

      <div className="px-5 py-6 max-w-2xl mx-auto">
        {subPage === 'main' && (
          <MainSettings
            t={t}
            lang={lang}
            setLang={setLang}
            user={user}
            onNavigate={setSubPage}
            onSignOut={handleSignOut}
          />
        )}
        {subPage === 'faq' && <FaqPage t={t} />}
        {subPage === 'backup' && <BackupPage t={t} />}
        {subPage === 'support' && <SupportPage t={t} />}
        {subPage === 'about' && <AboutPage t={t} />}
      </div>
    </div>
  );
}

function MainSettings({
  t,
  lang,
  setLang,
  user,
  onNavigate,
  onSignOut,
}: {
  t: (key: string) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
  user: { phone?: string; email?: string } | null;
  onNavigate: (page: SubPage) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* App identity */}
      <div className="relative overflow-hidden rounded-[28px] bg-navy-900 p-6 text-white shadow-xl shadow-navy-900/15 construction-panel">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-saffron-500/20" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-500 shadow-lg shadow-saffron-500/30">
            <HardHat className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-xl font-extrabold tracking-tight">{t('appName')}</p>
            <p className="mt-1 text-sm text-navy-200">{t('constructionTagline')}</p>
          </div>
        </div>
      </div>

      {/* User info card */}
      <div className="rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-100">
            <Globe className="h-7 w-7 text-navy-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">
              {user?.phone ?? user?.email ?? 'User'}
            </p>
            <p className="text-sm text-gray-500">{t('signedInAs')}</p>
          </div>
        </div>
      </div>

      {/* Language toggle */}
      <div className="rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-50">
              <Globe className="h-5 w-5 text-saffron-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{t('language')}</p>
              <p className="text-xs text-gray-500">{lang === 'en' ? 'English' : 'हिंदी'}</p>
            </div>
          </div>
          <LangToggle />
        </div>
      </div>

      {/* Menu items */}
      <div className="rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden">
        <SettingsRow
          icon={HelpCircle}
          iconBg="bg-navy-50"
          iconColor="text-navy-600"
          label={t('faq')}
          onClick={() => onNavigate('faq')}
        />
        <Divider />
        <SettingsRow
          icon={DatabaseBackup}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          label={t('backup')}
          onClick={() => onNavigate('backup')}
        />
        <Divider />
        <SettingsRow
          icon={Headphones}
          iconBg="bg-saffron-50"
          iconColor="text-saffron-600"
          label={t('contactSupport')}
          onClick={() => onNavigate('support')}
        />
        <Divider />
        <SettingsRow
          icon={Info}
          iconBg="bg-gray-100"
          iconColor="text-gray-600"
          label={t('about')}
          onClick={() => onNavigate('about')}
        />
      </div>

      {/* Logout */}
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-4 rounded-2xl bg-white border border-red-200 p-5 shadow-sm hover:bg-red-50 transition-colors text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
          <LogOut className="h-5 w-5 text-red-600" />
        </div>
        <span className="font-semibold text-red-600">{t('logout')}</span>
      </button>

      <p className="text-center text-xs text-gray-400">v1.0.0</p>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  onClick,
}: {
  icon: typeof HelpCircle;
  iconBg: string;
  iconColor: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <span className="flex-1 font-semibold text-gray-900">{label}</span>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 mx-5" />;
}

function FaqPage({ t }: { t: (key: string) => string }) {
  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
  ];

  return (
    <div className="space-y-4">
      {faqs.map((faq, i) => (
        <FaqItem key={i} question={faq.q} answer={faq.a} />
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        <ChevronRight
          className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

function BackupPage({ t }: { t: (key: string) => string }) {
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({
    type: null,
    msg: '',
  });
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const handleExport = async (type: 'workers' | 'attendance' | 'advances') => {
    setLoadingType(type);
    setStatus({ type: null, msg: '' });
    try {
      let csv = '';
      let filename = '';

      if (type === 'workers') {
        const workers = await fetchWorkers();
        if (workers.length === 0) {
          setStatus({ type: 'error', msg: t('noDataExport') });
          return;
        }
        csv = [
          'Name,Phone,Role,Daily Wage,NFC Card',
          ...workers.map((w) =>
            `"${w.name}","${w.phone}","${w.role}",${w.daily_wage ?? 0},"${w.nfc_tag_uid ?? ''}"`
          ),
        ].join('\n');
        filename = 'workers.csv';
      } else if (type === 'attendance') {
        const records = await fetchAttendanceHistory(1000);
        if (records.length === 0) {
          setStatus({ type: 'error', msg: t('noDataExport') });
          return;
        }
        csv = [
          'Date,Worker Name,Role,Phone,Time In,Status,Half Day',
          ...records.map((r) =>
            `"${r.date}","${r.worker.name}","${r.worker.role}","${r.worker.phone}","${r.time_in ?? ''}","${r.status}","${r.half_day ? 'Yes' : 'No'}"`
          ),
        ].join('\n');
        filename = 'attendance.csv';
      } else {
        const advances = await fetchRecentAdvances(1000);
        if (advances.length === 0) {
          setStatus({ type: 'error', msg: t('noDataExport') });
          return;
        }
        csv = [
          'Date,Worker Name,Role,Amount,Note',
          ...advances.map((a) =>
            `"${a.date}","${a.worker.name}","${a.worker.role}",${a.amount},"${a.note ?? ''}"`
          ),
        ].join('\n');
        filename = 'advances.csv';
      }

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', msg: t('backupSuccess') });
    } catch {
      setStatus({ type: 'error', msg: t('backupFailed') });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('backupDesc')}</p>

      {status.type && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 ${
            status.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {status.type === 'success' && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
          <p className={`text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {status.msg}
          </p>
        </div>
      )}

      <BackupButton
        icon={DatabaseBackup}
        label={t('exportWorkers')}
        loading={loadingType === 'workers'}
        onClick={() => handleExport('workers')}
      />
      <BackupButton
        icon={DatabaseBackup}
        label={t('exportAttendance')}
        loading={loadingType === 'attendance'}
        onClick={() => handleExport('attendance')}
      />
      <BackupButton
        icon={DatabaseBackup}
        label={t('exportAdvances')}
        loading={loadingType === 'advances'}
        onClick={() => handleExport('advances')}
      />
    </div>
  );
}

function BackupButton({
  icon: Icon,
  label,
  loading,
  onClick,
}: {
  icon: typeof DatabaseBackup;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-4 rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm hover:shadow-md hover:border-navy-300 transition-all text-left disabled:opacity-60"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50">
        <Icon className="h-6 w-6 text-navy-600" />
      </div>
      <span className="flex-1 font-semibold text-gray-900">{label}</span>
      {loading && (
        <svg className="h-5 w-5 animate-spin text-navy-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
    </button>
  );
}

function SupportPage({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('supportDesc')}</p>

      <a
        href="tel:+918000000000"
        className="flex items-center gap-4 rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm hover:shadow-md hover:border-navy-300 transition-all"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
          <Phone className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{t('callUs')}</p>
          <p className="text-sm text-gray-500">+91 80000 00000</p>
        </div>
      </a>

      <a
        href="mailto:support@workerattendance.app"
        className="flex items-center gap-4 rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm hover:shadow-md hover:border-navy-300 transition-all"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50">
          <Mail className="h-6 w-6 text-navy-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{t('emailUs')}</p>
          <p className="text-sm text-gray-500">support@workerattendance.app</p>
        </div>
      </a>

      <a
        href="https://wa.me/918000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm hover:shadow-md hover:border-navy-300 transition-all"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-saffron-50">
          <MessageCircle className="h-6 w-6 text-saffron-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{t('whatsappUs')}</p>
          <p className="text-sm text-gray-500">+91 80000 00000</p>
        </div>
      </a>

      <p className="text-center text-xs text-gray-400 mt-4">{t('supportHours')}</p>
    </div>
  );
}

function AboutPage({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-saffron-500 mb-4">
          <Info className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">{t('appName')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('version')} 1.0.0</p>
      </div>

      <div className="rounded-3xl bg-white ring-1 ring-navy-100 p-5 shadow-sm">
        <p className="text-sm text-gray-600 leading-relaxed">{t('aboutDesc')}</p>
      </div>

      <div className="rounded-3xl bg-white ring-1 ring-navy-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-900">{t('privacyPolicy')}</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
        <Divider />
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-900">{t('termsOfUse')}</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        {t('developedBy')} Worker Attendance Team
      </p>
    </div>
  );
}
