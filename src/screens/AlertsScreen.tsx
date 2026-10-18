import { useCallback, useEffect, useState } from 'react';
import { Bell, UserX, HandCoins, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useLang } from '@/context/LangContext';
import { fetchAbsentWorkers, fetchRecentAdvances } from '@/services/payrollService';
import { formatDateHeading } from '@/utils/date';
import type { Worker, Advance } from '@/types/database';

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function AlertsScreen({ isActive }: { isActive: boolean }) {
  const { t } = useLang();
  const [absentWorkers, setAbsentWorkers] = useState<Worker[]>([]);
  const [recentAdvances, setRecentAdvances] = useState<(Advance & { worker: Pick<Worker, 'name' | 'role'> })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [absent, advances] = await Promise.all([
        fetchAbsentWorkers(),
        fetchRecentAdvances(10),
      ]);
      setAbsentWorkers(absent);
      setRecentAdvances(advances);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) loadAlerts();
  }, [isActive, loadAlerts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
          <h1 className="text-lg font-bold text-gray-900">{t('alertsNotifications')}</h1>
        </header>
        <LoadingView message={t('loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
          <h1 className="text-lg font-bold text-gray-900">{t('alertsNotifications')}</h1>
        </header>
        <ErrorView message={t('couldNotLoad')} onRetry={loadAlerts} />
      </div>
    );
  }

  const hasAlerts = absentWorkers.length > 0 || recentAdvances.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <Bell className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{t('alertsNotifications')}</h1>
            <p className="text-xs text-gray-500">{absentWorkers.length + recentAdvances.length} {t('alerts')}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-5 py-6">
        {!hasAlerts && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm text-gray-600">{t('allMarked')}</p>
          </div>
        )}

        {/* Missing attendance */}
        {absentWorkers.length > 0 && (
          <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h3 className="font-bold text-gray-900">{t('missingAttendance')}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-3">{t('workersNotMarkedToday')}</p>
            <div className="space-y-2">
              {absentWorkers.map((worker) => (
                <div key={worker.id} className="flex items-center gap-3 rounded-xl bg-rose-50 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                    <UserX className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{worker.name}</p>
                    <p className="text-xs text-gray-500">{worker.role} · {worker.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent advances */}
        {recentAdvances.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <HandCoins className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-gray-900">{t('recentAdvances')}</h3>
            </div>
            <div className="space-y-2">
              {recentAdvances.map((advance) => (
                <div key={advance.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{advance.worker.name}</p>
                      {advance.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          <ShieldCheck className="h-3 w-3" /> {t('advanceStatusVerified')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <ShieldAlert className="h-3 w-3" /> {t('advanceStatusPending')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{advance.worker.role} · {formatDateHeading(advance.date)}</p>
                    {advance.note && <p className="text-xs text-gray-400 mt-0.5">{advance.note}</p>}
                  </div>
                  <span className="text-base font-bold text-amber-700">{money(Number(advance.amount))}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
