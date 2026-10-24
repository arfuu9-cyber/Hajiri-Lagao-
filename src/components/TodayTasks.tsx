import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, UserCheck } from 'lucide-react';
import { useLang } from '@/context/LangContext';
import { useTeamId } from '@/context/AuthContext';
import { fetchWorkers } from '@/services/workerService';
import { fetchAbsentWorkers } from '@/services/payrollService';
import { createAttendance, AttendanceDuplicateError } from '@/services/attendanceService';
import type { Worker } from '@/types/database';

interface TodayTasksProps {
  onOpenList: () => void;
  onChanged: () => void;
}

/** One-tap attendance for a thekedar's own workers. */
export function TodayTasks({ onOpenList, onChanged }: TodayTasksProps) {
  const { t } = useLang();
  const teamId = useTeamId();
  const [total, setTotal] = useState<number | null>(null);
  const [pending, setPending] = useState<Worker[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isMazdoor = useCallback(
    (w: Worker) => w.role !== 'Thekedar' && w.role !== 'Gatekeeper' && (!teamId || w.thekedar_id === teamId),
    [teamId]
  );

  const load = useCallback(async () => {
    try {
      const [all, absent] = await Promise.all([fetchWorkers(teamId), fetchAbsentWorkers()]);
      setTotal(all.filter(isMazdoor).length);
      setPending(absent.filter(isMazdoor));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [teamId, isMazdoor]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (ids: string[], key: string) => {
    setBusy(key);
    setFailed(false);
    try {
      for (const id of ids) {
        try {
          await createAttendance(id, 'present');
        } catch (err) {
          if (!(err instanceof AttendanceDuplicateError)) throw err;
        }
      }
      await load();
      onChanged();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  if (total === null || total === 0) return null;
  const none = pending.length === 0;

  return (
    <section className={`rounded-3xl p-5 shadow-sm ring-1 ${none ? 'bg-green-50 ring-green-200' : 'bg-white ring-saffron-200'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${none ? 'bg-green-500' : 'bg-saffron-500'}`}>
          {none ? <CheckCircle2 className="h-6 w-6 text-white" /> : <UserCheck className="h-6 w-6 text-white" />}
        </span>
        <div>
          <h2 className="text-base font-bold text-gray-900">
            {none ? t('tasksDone') : `${pending.length} ${t('tasksPending')}`}
          </h2>
          <p className="text-xs text-gray-500">{t('tasksTitle')}</p>
        </div>
      </div>

      {!none && (
        <>
          <ul className="mt-4 space-y-2">
            {pending.slice(0, 5).map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 rounded-2xl bg-concrete-50 px-4 py-3">
                <span className="truncate text-sm font-semibold text-gray-800">{w.name}</span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => mark([w.id], w.id)}
                  className="shrink-0 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy === w.id ? '...' : t('markPresent')}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => mark(pending.map((w) => w.id), 'all')}
              className="flex-1 rounded-2xl bg-navy-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === 'all' ? '...' : t('markAll')}
            </button>
            {pending.length > 5 && (
              <button
                type="button"
                onClick={onOpenList}
                className="rounded-2xl border border-navy-200 px-4 py-3 text-sm font-semibold text-navy-700"
              >
                {t('fullList')}
              </button>
            )}
          </div>
        </>
      )}

      {failed && <p className="mt-3 text-sm text-red-600">{t('couldNotSave')}</p>}
    </section>
  );
}
