import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Phone, Briefcase, IndianRupee, Calendar, HandCoins, TrendingUp, Clock, FileText, User, ShieldCheck, ShieldAlert } from 'lucide-react';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DutyBadge } from '@/components/AttendanceSelector';
import { useLang } from '@/context/LangContext';
import { fetchWorkerDetail, generateSalarySlipHTML, type PayrollRange } from '@/services/payrollService';
import { formatDateHeading, formatDateTimeInKolkata } from '@/utils/date';
import type { WorkerDetail } from '@/services/payrollService';
import { DUTY_TYPES } from '@/types/database';

interface WorkerDetailScreenProps {
  workerId: string;
  onBack: () => void;
}

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function WorkerDetailScreen({ workerId, onBack }: WorkerDetailScreenProps) {
  const { t } = useLang();
  const [detail, setDetail] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setDetail(await fetchWorkerDetail(workerId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const totalDays = detail?.attendance.reduce((sum, a) => sum + Number(a.duty_multiplier ?? (a.half_day ? 0.5 : 1)), 0) ?? 0;
  const totalEarned = detail ? totalDays * Number(detail.worker.daily_wage) : 0;
  const totalAdvances = detail?.advances.filter(a => a.status === 'verified').reduce((sum, a) => sum + Number(a.amount), 0) ?? 0;
  const pendingAdvances = detail?.advances.filter(a => a.status === 'pending').reduce((sum, a) => sum + Number(a.amount), 0) ?? 0;
  const netPayable = Math.max(0, totalEarned - totalAdvances);

  const monthAttendance = detail?.attendance.filter((a) => {
    const d = new Date(a.date + 'T00:00:00');
    return d.getFullYear() === calendarMonth.year && d.getMonth() === calendarMonth.month;
  }) ?? [];
  const attendanceMap = new Map<string, { status: string; half_day: boolean; duty_multiplier: number }>();
  monthAttendance.forEach((a) => attendanceMap.set(a.date, { status: a.status, half_day: a.half_day, duty_multiplier: Number(a.duty_multiplier ?? (a.half_day ? 0.5 : 1)) }));

  const handlePrintSlip = () => {
    if (!detail) return;
    const range: PayrollRange = { start: `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-01`, end: `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate()}` };
    const row = {
      worker: { id: detail.worker.id, name: detail.worker.name, role: detail.worker.role, daily_wage: detail.worker.daily_wage },
      totalDays,
      totalWage: totalEarned,
      overtimePay: 0,
      advancesCut: totalAdvances,
      finalPayout: netPayable,
    };
    const html = generateSalarySlipHTML(row, range);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const monthName = new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
  const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1).getDay();

  const prevMonth = () => {
    setCalendarMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const nextMonth = () => {
    setCalendarMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
          <button onClick={onBack} className="flex items-center gap-3"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
        </header>
        <LoadingView message={t('loading')} />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
          <button onClick={onBack} className="flex items-center gap-3"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
        </header>
        <ErrorView message={t('couldNotLoad')} onRetry={loadDetail} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/95 backdrop-blur border-b border-navy-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center justify-center h-10 w-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('workerDetails')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-5 py-6">
        {/* Profile card */}
        <section className="rounded-3xl ring-1 ring-navy-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            {detail.worker.profile_photo_url ? (
              <img
                src={detail.worker.profile_photo_url}
                alt={detail.worker.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-saffron-100">
                <Briefcase className="h-8 w-8 text-saffron-600" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{detail.worker.name}</h2>
              <p className="text-sm text-gray-500">{detail.worker.role}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" /> {detail.worker.phone}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <IndianRupee className="h-4 w-4 text-gray-400" /> {money(Number(detail.worker.daily_wage))}{t('perDay')}
            </div>
            {detail.worker.age != null && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4 text-gray-400" /> {t('ageLabel')}: {detail.worker.age}
                {detail.worker.age < 18 && (
                  <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {t('under18')}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Salary Summary */}
        <section className="rounded-3xl ring-1 ring-navy-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('salarySummary')}</h3>
            <button onClick={handlePrintSlip} className="inline-flex items-center gap-1.5 rounded-lg bg-saffron-50 px-3 py-2 text-sm font-semibold text-saffron-700 hover:bg-saffron-100">
              <FileText className="h-4 w-4" /> Salary Slip
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t('totalDaysWorked')} value={String(totalDays)} icon={Calendar} />
            <StatCard label={t('totalEarned')} value={money(totalEarned)} icon={TrendingUp} />
            <StatCard label={t('totalAdvances')} value={money(totalAdvances)} icon={HandCoins} />
            <StatCard label={t('netPayable')} value={money(netPayable)} icon={IndianRupee} highlight />
          </div>
          {pendingAdvances > 0 && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                {money(pendingAdvances)} {t('advanceStatusPending')} — {t('onlyVerifiedCounted')}
              </p>
            </div>
          )}
        </section>

        {/* Attendance Calendar */}
        <section className="rounded-3xl ring-1 ring-navy-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('attendanceCalendar')}</h3>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">‹</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">{monthName}</span>
              <button onClick={nextMonth} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">›</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = attendanceMap.get(dateStr);
              const multiplier = record?.duty_multiplier ?? 1;
              const duty = DUTY_TYPES.find((d) => d.value === multiplier);
              return (
                <div
                  key={day}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm font-medium ${
                    record
                      ? `${duty?.bgClass ?? 'bg-green-100'} ${duty?.textClass ?? 'text-green-700'}`
                      : 'bg-gray-50 text-gray-400'
                  }`}
                  title={record ? t(duty?.labelKey ?? 'duty_1') : t('absent')}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-gray-500">
            {DUTY_TYPES.map((duty) => (
              <span key={duty.value} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${duty.solidBgClass}`} /> {t(duty.labelKey)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-gray-100" /> {t('absent')}
            </span>
          </div>
        </section>

        {/* Advance History */}
        <section className="rounded-3xl ring-1 ring-navy-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">{t('advanceHistory')}</h3>
          {detail.advances.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{t('noAdvancesYet')}</p>
          ) : (
            <div className="space-y-2">
              {detail.advances.map((advance) => (
                <div key={advance.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{money(Number(advance.amount))}</p>
                      {advance.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          <ShieldCheck className="h-3 w-3" /> {t('advanceStatusVerified')}
                        </span>
                      ) : advance.status === 'disputed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                          <ShieldAlert className="h-3 w-3" /> {t('advanceStatusDisputed')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <ShieldAlert className="h-3 w-3" /> {t('advanceStatusPending')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateHeading(advance.date)}</p>
                    {advance.note && <p className="text-xs text-gray-400 mt-0.5">{advance.note}</p>}
                    {advance.status === 'disputed' && advance.dispute_reason && <p className="mt-1 text-xs font-semibold text-rose-700">Mazdoor ki dikkat: {advance.dispute_reason}</p>}
                  </div>
                  <HandCoins className="h-5 w-5 text-amber-500" />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight = false }: { label: string; value: string; icon: typeof Calendar; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${highlight ? 'text-green-600' : 'text-gray-400'}`} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`mt-1.5 text-lg font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
