import { useState, useCallback, useEffect } from 'react';
import {
  HardHat, Nfc, UserPlus, UserCheck, UserX, WalletCards, Bell,
  TrendingUp, IndianRupee, HandCoins, QrCode, CreditCard,
  ScanLine, Users, ChevronDown, ChevronUp, Calendar, Eye,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { ErrorView } from '@/components/ErrorView';
import { fetchDashboardData, fetchLabourDashboardData, type DashboardData, type LabourDashboardData } from '@/services/payrollService';
import type { UserRole } from '@/types/database';

interface HomeScreenProps {
  onNavigate: (screen: 'nfcAttendance' | 'addWorker' | 'payroll' | 'alerts' | 'registration' | 'gatePass' | 'gatePassScanner' | 'workerDetail' | 'viewWorkers') => void;
  role: UserRole;
}

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function HomeScreen({ onNavigate, role }: HomeScreenProps) {
  const { profile } = useAuth();
  const { t } = useLang();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [labourStats, setLabourStats] = useState<LabourDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (role === 'labour') {
        const workerName = profile?.display_name?.trim();
        if (workerName) {
          const data = await fetchLabourDashboardData(workerName);
          setLabourStats(data);
        }
      } else {
        const data = await fetchDashboardData();
        setStats(data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [role, profile?.display_name]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const roleLabel = profile ? t(`role_${profile.role}`) : '';

  return (
    <div className="min-h-screen bg-concrete-50">
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-5">
        <section className="relative overflow-hidden rounded-[28px] bg-navy-900 px-6 py-6 text-white shadow-xl shadow-navy-900/15 construction-panel">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-saffron-500/20" />
          <div className="absolute -bottom-12 right-16 h-28 w-28 rounded-full border-[12px] border-white/5" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-saffron-300">{t('siteDashboard')}</p>
              <h1 className="text-2xl font-extrabold tracking-tight">{t('todaysOverview')}</h1>
              <p className="mt-1 text-sm text-navy-200">
                {roleLabel}{profile?.display_name ? ` · ${profile.display_name}` : ''}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-saffron-500 shadow-lg shadow-saffron-500/30">
              <HardHat className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="relative mt-6 flex items-center gap-2 text-xs font-semibold text-navy-100">
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_0_4px_rgba(74,222,128,0.15)]" />
            {t('siteReady')}
          </div>
        </section>
        {/* === THEKEDAR === */}
        {role === 'thekedar' && (
          <>
            {/* Dashboard stats */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('todaysOverview')}</h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('presentToday')} value="" icon={UserCheck} loading accentColor="bg-green-50" />
                  <DashboardStatCard label={t('absentToday')} value="" icon={UserX} loading accentColor="bg-coral-50" />
                  <DashboardStatCard label={t('weeklyPayout')} value="" icon={IndianRupee} loading accentColor="bg-amber-50" />
                  <DashboardStatCard label={t('attendanceRate')} value="" icon={TrendingUp} loading accentColor="bg-teal-50" />
                </div>
              ) : error ? (
                <ErrorView message={t('couldNotLoad')} onRetry={loadStats} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <DashboardStatCard label={t('presentToday')} value={stats?.presentToday ?? 0} icon={UserCheck} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-green-50" />
                    <DashboardStatCard label={t('absentToday')} value={stats?.absentToday ?? 0} icon={UserX} onClick={() => onNavigate('alerts')} accentColor="bg-coral-50" />
                    <DashboardStatCard label={t('weeklyPayout')} value={money(stats?.weeklyPayout ?? 0)} icon={IndianRupee} onClick={() => onNavigate('payroll')} accentColor="bg-amber-50" />
                    <DashboardStatCard label={t('attendanceRate')} value={`${stats?.attendanceRate ?? 0}%`} icon={TrendingUp} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-teal-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <DashboardStatCard label={t('newWorkersToday')} value={stats?.newWorkersToday ?? 0} icon={UserPlus} onClick={() => onNavigate('addWorker')} accentColor="bg-saffron-50" />
                    <DashboardStatCard label={t('pendingAdvances')} value={money(stats?.pendingAdvances ?? 0)} icon={HandCoins} onClick={() => onNavigate('payroll')} accentColor="bg-rose-50" />
                  </div>
                </>
              )}
            </section>

            {/* Quick actions */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('quickActions')}</h2>
              <div className="space-y-4">
                <ActionButton
                  icon={Nfc}
                  iconBg="bg-saffron-50"
                  iconColor="text-saffron-600"
                  title={t('markAttendance')}
                  desc={t('markAttendanceDesc')}
                  onClick={() => onNavigate('nfcAttendance')}
                />
                <ActionButton
                  icon={QrCode}
                  iconBg="bg-navy-100"
                  iconColor="text-navy-700"
                  title={t('gatePassAction')}
                  desc={t('gatePassThekedarDesc')}
                  onClick={() => onNavigate('gatePass')}
                />
                <ActionButton
                  icon={WalletCards}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-600"
                  title={t('viewPayroll')}
                  desc={t('viewPayrollDesc')}
                  onClick={() => onNavigate('payroll')}
                />
              </div>
            </section>

            {/* More actions */}
            <section>
              <button
                onClick={() => setShowMore((s) => !s)}
                className="w-full flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md transition-all"
              >
                <span className="font-semibold text-gray-700">{t('moreActions')}</span>
                {showMore ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {showMore && (
                <div className="space-y-4 mt-4">
                  <ActionButton
                    icon={UserPlus}
                    iconBg="bg-green-50"
                    iconColor="text-green-600"
                    title={t('addNewWorker')}
                    desc={t('addNewWorkerDesc')}
                    onClick={() => onNavigate('addWorker')}
                  />
                  <ActionButton
                    icon={CreditCard}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title={t('newRegistrationAction')}
                    desc={t('newRegistrationDesc')}
                    onClick={() => onNavigate('registration')}
                  />
                  <ActionButton
                    icon={Bell}
                    iconBg="bg-rose-50"
                    iconColor="text-rose-600"
                    title={t('viewAlerts')}
                    desc={t('viewAlertsDesc')}
                    onClick={() => onNavigate('alerts')}
                  />
                </div>
              )}
            </section>
          </>
        )}

        {/* === GATEKEEPER === */}
        {role === 'gatekeeper' && (
          <>
            {/* Dashboard stats */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('todaysOverview')}</h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('presentToday')} value="" icon={UserCheck} loading accentColor="bg-green-50" />
                  <DashboardStatCard label={t('absentToday')} value="" icon={UserX} loading accentColor="bg-coral-50" />
                  <DashboardStatCard label={t('activeWorkers')} value="" icon={Users} loading accentColor="bg-navy-50" />
                  <DashboardStatCard label={t('attendanceRate')} value="" icon={TrendingUp} loading accentColor="bg-teal-50" />
                </div>
              ) : error ? (
                <ErrorView message={t('couldNotLoad')} onRetry={loadStats} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('presentToday')} value={stats?.presentToday ?? 0} icon={UserCheck} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-green-50" />
                  <DashboardStatCard label={t('absentToday')} value={stats?.absentToday ?? 0} icon={UserX} onClick={() => onNavigate('alerts')} accentColor="bg-coral-50" />
                  <DashboardStatCard label={t('activeWorkers')} value={stats?.activeWorkers ?? 0} icon={Users} onClick={() => onNavigate('viewWorkers')} accentColor="bg-navy-50" />
                  <DashboardStatCard label={t('attendanceRate')} value={`${stats?.attendanceRate ?? 0}%`} icon={TrendingUp} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-teal-50" />
                </div>
              )}
            </section>

            {/* Quick actions */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('quickActions')}</h2>
              <div className="space-y-4">
                <ActionButton
                  icon={ScanLine}
                  iconBg="bg-saffron-50"
                  iconColor="text-saffron-600"
                  title={t('gatePassScanner')}
                  desc={t('gatePassScannerDesc')}
                  onClick={() => onNavigate('gatePassScanner')}
                />
                <ActionButton
                  icon={Nfc}
                  iconBg="bg-green-50"
                  iconColor="text-green-600"
                  title={t('markAttendance')}
                  desc={t('markAttendanceDesc')}
                  onClick={() => onNavigate('nfcAttendance')}
                />
              </div>
            </section>

            {/* More actions */}
            <section>
              <button
                onClick={() => setShowMore((s) => !s)}
                className="w-full flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md transition-all"
              >
                <span className="font-semibold text-gray-700">{t('moreActions')}</span>
                {showMore ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {showMore && (
                <div className="space-y-4 mt-4">
                  <ActionButton
                    icon={Users}
                    iconBg="bg-navy-100"
                    iconColor="text-navy-700"
                    title={t('workers')}
                    desc={t('viewAllWorkers')}
                    onClick={() => onNavigate('viewWorkers')}
                  />
                  <ActionButton
                    icon={CreditCard}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title={t('newRegistrationAction')}
                    desc={t('newRegistrationDesc')}
                    onClick={() => onNavigate('registration')}
                  />
                </div>
              )}
            </section>
          </>
        )}

        {/* === LABOUR === */}
        {role === 'labour' && (
          <>
            {/* Personal stats */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('mySummary')}</h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('myDaysThisWeek')} value="" icon={Calendar} loading accentColor="bg-teal-50" />
                  <DashboardStatCard label={t('myEarnings')} value="" icon={IndianRupee} loading accentColor="bg-amber-50" />
                </div>
              ) : error ? (
                <ErrorView message={t('couldNotLoad')} onRetry={loadStats} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('myDaysThisWeek')} value={labourStats?.myDaysThisWeek ?? 0} icon={Calendar} onClick={() => onNavigate('workerDetail')} accentColor="bg-teal-50" />
                  <DashboardStatCard label={t('myEarnings')} value={money(labourStats?.myEarnings ?? 0)} icon={IndianRupee} onClick={() => onNavigate('workerDetail')} accentColor="bg-amber-50" />
                  <DashboardStatCard label={t('myAdvances')} value={money(labourStats?.myAdvances ?? 0)} icon={HandCoins} onClick={() => onNavigate('workerDetail')} accentColor="bg-rose-50" />
                  <DashboardStatCard label={t('dailyWage')} value={money(labourStats?.myDailyWage ?? 0)} icon={WalletCards} onClick={() => onNavigate('workerDetail')} accentColor="bg-navy-50" />
                </div>
              )}
            </section>

            {/* Quick actions — only what a labour needs */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('quickActions')}</h2>
              <div className="space-y-4">
                <ActionButton
                  icon={Nfc}
                  iconBg="bg-saffron-50"
                  iconColor="text-saffron-600"
                  title={t('myAttendance')}
                  desc={t('myAttendanceDesc')}
                  onClick={() => onNavigate('nfcAttendance')}
                />
                <ActionButton
                  icon={Eye}
                  iconBg="bg-navy-100"
                  iconColor="text-navy-700"
                  title={t('myDetails')}
                  desc={t('myDetailsDesc')}
                  onClick={() => onNavigate('workerDetail')}
                />
              </div>
            </section>

            {/* More actions */}
            <section>
              <button
                onClick={() => setShowMore((s) => !s)}
                className="w-full flex items-center justify-between rounded-2xl bg-white border border-gray-200 px-5 py-4 shadow-sm hover:shadow-md transition-all"
              >
                <span className="font-semibold text-gray-700">{t('moreActions')}</span>
                {showMore ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {showMore && (
                <div className="space-y-4 mt-4">
                  <ActionButton
                    icon={CreditCard}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title={t('newRegistrationAction')}
                    desc={t('newRegistrationDesc')}
                    onClick={() => onNavigate('registration')}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  desc,
  onClick,
}: {
  icon: typeof HardHat;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-2xl bg-white border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-navy-300 transition-all text-left"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${iconBg} shrink-0`}>
        <Icon className={`h-7 w-7 ${iconColor}`} />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}
