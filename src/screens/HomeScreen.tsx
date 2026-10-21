import { useState, useCallback, useEffect } from 'react';
import {
  HardHat, Nfc, UserPlus, UserCheck, UserX, WalletCards, Bell,
  TrendingUp, IndianRupee, HandCoins, QrCode, CreditCard,
  ScanLine, Users, ChevronDown, ChevronUp, Calendar, Eye, CheckCircle2, Clock, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LangContext';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { ErrorView } from '@/components/ErrorView';
import { errText } from '@/utils/errors';
import { TodayTasks } from '@/components/TodayTasks';
import { PendingAttendanceApprovals } from '@/components/PendingAttendanceApprovals';
import { AdvanceRequests } from '@/components/AdvanceRequests';
import { createAttendance, AttendanceDuplicateError } from '@/services/attendanceService';
import { getKolkataDateString } from '@/utils/date';
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
  const { profile, myWorker } = useAuth();
  const { t } = useLang();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [labourStats, setLabourStats] = useState<LabourDashboardData | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [selfMarking, setSelfMarking] = useState(false);
  const [selfError, setSelfError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (role === 'labour') {
        const workerName = profile?.display_name?.trim();
        if (myWorker?.id || workerName) {
          const data = await fetchLabourDashboardData({ id: myWorker?.id, name: workerName }, period);
          setLabourStats(data);
        }
      } else {
        const data = await fetchDashboardData();
        setStats(data);
      }
    } catch (err) {
      setError(true);
      setErrorDetail(errText(err));
    } finally {
      setLoading(false);
    }
  }, [role, profile?.display_name, myWorker?.id, period]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Mazdoor: pick up the thekedar's new haziri / kharchi without reloading
  useEffect(() => {
    if (role !== 'labour') return;
    const timer = setInterval(async () => {
      try {
        const data = await fetchLabourDashboardData({ id: myWorker?.id, name: profile?.display_name }, period);
        if (data) setLabourStats(data);
      } catch {
        /* keep showing the last data */
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [role, myWorker?.id, profile?.display_name, period]);

  const markMyself = async () => {
    if (!myWorker) return;
    setSelfMarking(true);
    setSelfError(false);
    try {
      try {
        await createAttendance(myWorker.id, 'present');
      } catch (err) {
        if (!(err instanceof AttendanceDuplicateError)) throw err;
      }
      await loadStats();
    } catch {
      setSelfError(true);
    } finally {
      setSelfMarking(false);
    }
  };
  const todayStr = getKolkataDateString();
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const firstName = profile?.display_name?.trim().split(' ')[0] ?? '';
  const todayAttendance = labourStats?.recent?.find((r) => r.kind === 'attendance' && r.date === todayStr);
  const markedToday = todayAttendance?.status === 'approved';
  const pendingToday = todayAttendance?.status === 'pending';
  const rejectedToday = todayAttendance?.status === 'rejected';
  const roleLabel = profile ? t(`role_${profile.role}`) : '';

  return (
    <div className="min-h-screen bg-concrete-50">
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-5">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-navy-500 to-navy-800 px-6 py-6 text-white shadow-xl shadow-navy-600/20">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-saffron-500/25" />
          <div className="relative">
            <p className="text-sm font-medium text-navy-100">{todayLabel}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              {t('namaste')}{firstName ? `, ${firstName}` : ''}
            </h1>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <HardHat className="h-3.5 w-3.5 text-saffron-300" />
              {roleLabel}
            </span>
            {role === 'thekedar' && stats && stats.activeWorkers > 0 && (
              <div className="mt-5">
                <div className="flex items-end justify-between text-white">
                  <span className="text-sm font-medium text-navy-100">{t('tasksTitle')}</span>
                  <span className="text-lg font-extrabold">{stats.presentToday}/{Math.max(0, stats.activeWorkers - stats.onLeaveToday)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-saffron-400 transition-all" style={{ width: `${Math.min(100, stats.attendanceRate)}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-white/90">
                  <span>{stats.presentToday} {t('presentToday')}</span>
                  <span>{stats.onLeaveToday} {t('onLeaveToday')}</span>
                  <span>{stats.absentToday} {t('attendancePending')}</span>
                </div>
              </div>
            )}
          </div>
        </section>
        {/* === THEKEDAR === */}
        {role === 'thekedar' && (
          <>
            {!loading && !error && (stats?.presentToday ?? 0) + (stats?.absentToday ?? 0) + (stats?.onLeaveToday ?? 0) === 0 && (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-navy-100">
              <h2 className="mb-3 text-base font-bold text-gray-900">{t('howTitle')}</h2>
              <ol className="space-y-3">
                {[t('howStep1'), t('howStep2'), t('howStep3')].map((text, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron-500 text-sm font-bold text-white">{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{text}</span>
                  </li>
                ))}
              </ol>
            </section>
            )}
            <TodayTasks onOpenList={() => onNavigate('nfcAttendance')} onChanged={loadStats} />
            <PendingAttendanceApprovals onChanged={loadStats} />
            <AdvanceRequests onChanged={loadStats} />
            <div className="grid grid-cols-3 gap-3">
              <QuickTile icon={UserPlus} color="bg-saffron-500" label={t('tileNewWorker')} onClick={() => onNavigate('addWorker')} />
              <QuickTile icon={HandCoins} color="bg-navy-700" label={t('tileGiveAdvance')} onClick={() => onNavigate('viewWorkers')} />
              <QuickTile icon={WalletCards} color="bg-navy-600" label={t('tileHisaab')} onClick={() => onNavigate('payroll')} />
              <QuickTile icon={Nfc} color="bg-green-500" label={t('tileNfc')} onClick={() => onNavigate('nfcAttendance')} />
              <QuickTile icon={CreditCard} color="bg-navy-500" label={t('tileRegister')} onClick={() => onNavigate('registration')} />
              <QuickTile icon={Bell} color="bg-saffron-600" label={t('tileAlerts')} onClick={() => onNavigate('alerts')} />
            </div>
            {/* Dashboard stats */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('todaysOverview')}</h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('presentToday')} value="" icon={UserCheck} loading accentColor="bg-green-50" />
                  <DashboardStatCard label={t('attendancePending')} value="" icon={UserX} loading accentColor="bg-coral-50" />
                  <DashboardStatCard label={t('pendingAdvances')} value="" icon={HandCoins} loading accentColor="bg-amber-50" />
                  <DashboardStatCard label={t('attendanceRate')} value="" icon={TrendingUp} loading accentColor="bg-teal-50" />
                </div>
              ) : error ? (
                <ErrorView message={t('couldNotLoad')} onRetry={loadStats} detail={errorDetail} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <DashboardStatCard label={t('presentToday')} value={stats?.presentToday ?? 0} icon={UserCheck} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-green-50" />
                    <DashboardStatCard label={t('attendancePending')} value={stats?.absentToday ?? 0} icon={UserX} onClick={() => onNavigate('alerts')} accentColor="bg-coral-50" />
                    <DashboardStatCard label={t('attendanceRate')} value={`${stats?.attendanceRate ?? 0}%`} icon={TrendingUp} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-teal-50" />
                    <DashboardStatCard label={t('pendingAdvances')} value={money(stats?.pendingAdvances ?? 0)} icon={HandCoins} onClick={() => onNavigate('payroll')} accentColor="bg-rose-50" />
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* === GATEKEEPER === */}
        {role === 'gatekeeper' && (
          <>
            <button
              onClick={() => onNavigate('gatePassScanner')}
              className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-saffron-400 to-saffron-600 p-6 text-left text-white shadow-xl shadow-saffron-500/30 transition active:scale-[0.98]"
            >
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <ScanLine className="h-9 w-9" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-extrabold">{t('gatePassScanner')}</span>
                <span className="mt-1 block text-sm text-white/90">{t('gatePassScannerDesc')}</span>
              </span>
              <ChevronRight className="h-6 w-6 shrink-0" />
            </button>
            {/* Dashboard stats */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('todaysOverview')}</h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('presentToday')} value="" icon={UserCheck} loading accentColor="bg-green-50" />
                  <DashboardStatCard label={t('attendancePending')} value="" icon={UserX} loading accentColor="bg-coral-50" />
                  <DashboardStatCard label={t('activeWorkers')} value="" icon={Users} loading accentColor="bg-navy-50" />
                  <DashboardStatCard label={t('attendanceRate')} value="" icon={TrendingUp} loading accentColor="bg-teal-50" />
                </div>
              ) : error ? (
                <ErrorView message={t('couldNotLoad')} onRetry={loadStats} detail={errorDetail} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('presentToday')} value={stats?.presentToday ?? 0} icon={UserCheck} onClick={() => onNavigate('nfcAttendance')} accentColor="bg-green-50" />
                  <DashboardStatCard label={t('attendancePending')} value={stats?.absentToday ?? 0} icon={UserX} onClick={() => onNavigate('alerts')} accentColor="bg-coral-50" />
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
                  icon={Nfc}
                  iconBg="bg-green-500"
                  iconColor="text-white"
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
                className="w-full flex items-center justify-between rounded-3xl bg-white ring-1 ring-navy-100 px-5 py-4 shadow-sm hover:shadow-md transition-all"
              >
                <span className="font-semibold text-gray-700">{t('moreActions')}</span>
                {showMore ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {showMore && (
                <div className="space-y-4 mt-4">
                  <ActionButton
                    icon={Users}
                    iconBg="bg-navy-500"
                    iconColor="text-white"
                    title={t('workers')}
                    desc={t('viewAllWorkers')}
                    onClick={() => onNavigate('viewWorkers')}
                  />
                  <ActionButton
                    icon={CreditCard}
                    iconBg="bg-navy-500"
                    iconColor="text-white"
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
            {!loading && labourStats && (
              <section className={`rounded-3xl p-5 shadow-sm ring-1 ${markedToday ? 'bg-green-50 ring-green-200' : pendingToday ? 'bg-sky-50 ring-sky-200' : rejectedToday ? 'bg-rose-50 ring-rose-200' : 'bg-saffron-50 ring-saffron-200'}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${markedToday ? 'bg-green-500' : pendingToday ? 'bg-sky-600' : rejectedToday ? 'bg-rose-500' : 'bg-saffron-500'}`}>
                    {markedToday ? <CheckCircle2 className="h-6 w-6 text-white" /> : <Clock className="h-6 w-6 text-white" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-gray-900">{markedToday ? 'Hajiri approve ho gayi' : pendingToday ? 'Request bhej di gayi' : rejectedToday ? 'Request approve nahi hui' : t('todayPending')}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600">
                      {markedToday ? 'Aaj ki hajiri final hai aur hisaab mein count hogi.' : pendingToday ? 'Thekedar ki approval ka intezaar hai. Approve hone tak salary mein count nahi hogi.' : rejectedToday ? `Thekedar ka reason: ${todayAttendance?.note || 'Apne thekedar se baat karein.'}` : t('todayPendingHint')}
                    </p>
                  </div>
                </div>
                {!markedToday && !pendingToday && !rejectedToday && myWorker && (
                  <button
                    type="button"
                    onClick={markMyself}
                    disabled={selfMarking}
                    className="mt-4 w-full rounded-2xl bg-[#0A6B4B] px-4 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {selfMarking ? 'Request bhej rahe hain...' : 'Aaj ki hajiri request bhejo'}
                  </button>
                )}
                {rejectedToday && <p className="mt-3 text-xs font-semibold text-rose-700">Aapke paas request ki date/time ka record rahega. Hajiri badalne ke liye thekedar se baat karein.</p>}
                {selfError && <p className="mt-2 text-sm text-red-600">{t('couldNotSave')}</p>}
              </section>
            )}
            {/* Personal stats */}
            <div className="flex gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-navy-100">
              {(['week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${period === p ? 'bg-navy-600 text-white' : 'text-gray-500'}`}
                >
                  {t(p === 'week' ? 'periodWeek' : 'periodMonth')}
                </button>
              ))}
            </div>
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('mySummary')}</h2>
              {loading ? (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={t('myDaysThisWeek')} value="" icon={Calendar} loading accentColor="bg-teal-50" />
                  <DashboardStatCard label={t('myEarnings')} value="" icon={IndianRupee} loading accentColor="bg-amber-50" />
                </div>
              ) : error ? (
                <ErrorView message={t('couldNotLoad')} onRetry={loadStats} detail={errorDetail} />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <DashboardStatCard label={period === 'month' ? t('myDaysMonth') : t('myDaysThisWeek')} value={labourStats?.myDaysThisWeek ?? 0} icon={Calendar} onClick={() => onNavigate('workerDetail')} accentColor="bg-teal-50" />
                  <DashboardStatCard label={t('myEarnings')} value={money(labourStats?.myEarnings ?? 0)} icon={IndianRupee} onClick={() => onNavigate('workerDetail')} accentColor="bg-amber-50" />
                  <DashboardStatCard label={t('myAdvances')} value={money(labourStats?.myAdvances ?? 0)} icon={HandCoins} onClick={() => onNavigate('workerDetail')} accentColor="bg-rose-50" />
                  <DashboardStatCard label={t('dailyWage')} value={money(labourStats?.myDailyWage ?? 0)} icon={WalletCards} onClick={() => onNavigate('workerDetail')} accentColor="bg-navy-50" />
                </div>
              )}
            </section>

            {(labourStats?.recent?.length ?? 0) > 0 && (
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-3">{t('recentUpdates')}</h2>
                <div className="space-y-2">
                  {labourStats!.recent.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.kind === 'attendance' ? 'bg-green-500' : r.kind === 'payment' ? 'bg-navy-500' : 'bg-saffron-500'}`}>
                        {r.kind === 'attendance' ? <UserCheck className="h-5 w-5 text-white" /> : r.kind === 'payment' ? <IndianRupee className="h-5 w-5 text-white" /> : <HandCoins className="h-5 w-5 text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {r.kind === 'attendance' ? t('updAttendance') : r.kind === 'payment' ? `${t('updPaid')} ${money(r.amount)}` : `${t('updAdvance')} ${money(r.amount)}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {r.date}{r.kind === 'advance' ? ` · ${r.status === 'verified' ? t('updVerified') : t('updPending')}` : r.kind === 'attendance' ? ` · ${r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? `Rejected${r.note ? `: ${r.note}` : ''}` : 'Pending approval'}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Quick actions — only what a labour needs */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('quickActions')}</h2>
              <div className="space-y-4">
                <ActionButton
                  icon={Eye}
                  iconBg="bg-sky-500"
                  iconColor="text-white"
                  title={t('myDetails')}
                  desc={t('myDetailsDesc')}
                  onClick={() => onNavigate('workerDetail')}
                />
              </div>
            </section>

            {/* More actions */}
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
      className="flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-navy-100 transition hover:shadow-md active:scale-[0.98]"
    >
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconBg} shadow-md`}>
        <Icon className={`h-7 w-7 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="mt-0.5 text-sm leading-snug text-gray-500">{desc}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
    </button>
  );
}

function QuickTile({ icon: Icon, color, label, onClick }: { icon: typeof UserPlus; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-3xl bg-white px-2 py-4 shadow-sm ring-1 ring-navy-100 transition active:scale-95"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-center text-xs font-bold text-gray-800">{label}</span>
    </button>
  );
}
