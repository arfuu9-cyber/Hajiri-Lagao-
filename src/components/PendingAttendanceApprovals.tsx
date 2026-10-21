import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  approveAttendanceRequest,
  fetchPendingAttendanceApprovals,
  rejectAttendanceRequest,
  type AttendanceApprovalItem,
} from '@/services/attendanceService';
import type { DutyMultiplier } from '@/types/database';
import { getKolkataDateString } from '@/utils/date';

interface PendingAttendanceApprovalsProps {
  onChanged?: () => void;
}

/** A thekedar-only review queue. The backend RLS policy is the actual security boundary. */
export function PendingAttendanceApprovals({ onChanged }: PendingAttendanceApprovalsProps) {
  const [rows, setRows] = useState<AttendanceApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await fetchPendingAttendanceApprovals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance requests load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Workers can submit a request from a different phone, so refresh the queue periodically.
    const refreshId = window.setInterval(async () => {
      try {
        setRows(await fetchPendingAttendanceApprovals());
      } catch {
        // Keep the last known queue visible if the network temporarily drops.
      }
    }, 20000);
    return () => window.clearInterval(refreshId);
  }, [load]);

  const review = async (row: AttendanceApprovalItem, multiplier: DutyMultiplier | 'reject') => {
    setBusyId(row.id);
    setError('');
    setMessage('');
    try {
      if (multiplier === 'reject') {
        const reason = window.prompt('Reject karne ka reason likho (worker ko dikhaya jayega):', 'Aaj ki duty verify nahi hui');
        if (reason === null) return;
        if (!reason.trim()) {
          setError('Reject karne ke liye ek chhota reason likhna zaroori hai.');
          return;
        }
        await rejectAttendanceRequest(row.id, reason);
        setMessage(`${row.worker.name} ki request reject ho gayi; reason record ho gaya.`);
      } else {
        await approveAttendanceRequest(row.id, multiplier);
        setMessage(`${row.worker.name} ki hajiri approve ho gayi.`);
      }
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request update nahi hui.');
    } finally {
      setBusyId(null);
    }
  };

  const today = getKolkataDateString();

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-slate-900">Hajiri approval</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{rows.filter((row) => row.approval_status === 'pending').length} pending</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Mazdoor ki request final hajiri ya salary mein tabhi count hogi jab aap approve karoge.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh attendance requests" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Requests load ho rahi hain...</p>}
      {!loading && rows.length === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <Check className="h-5 w-5" /> Abhi koi pending request nahi hai.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mt-4 space-y-3">
          {rows.map((row) => {
            const isToday = row.date === today;
            const wasRejected = row.approval_status === 'rejected';
            const busy = busyId === row.id;
            return (
              <article key={row.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-extrabold text-slate-600">
                    {row.worker.name.trim().slice(0, 1).toUpperCase() || 'M'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-900">{row.worker.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.worker.role || 'Worker'} · {row.worker.phone || 'Phone nahi diya'}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" /> {row.date} · {new Date(row.time_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                      {!isToday && <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 font-bold text-orange-800">Purani request</span>}
                    </p>
                    {wasRejected && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Pehle reject hui thi: {row.rejection_reason || 'Reason nahi diya gaya'}. Dobara verify karke approve kar sakte ho.</p>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyId !== null} onClick={() => void review(row, 1)} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">
                    <Check className="h-4 w-4" /> {busy ? 'Saving...' : wasRejected ? 'Approve after re-check' : 'Full day approve'}
                  </button>
                  <button type="button" disabled={busyId !== null} onClick={() => void review(row, 0.5)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-extrabold text-amber-900 disabled:opacity-50">
                    Half day
                  </button>
                  {!wasRejected && <button type="button" disabled={busyId !== null} onClick={() => void review(row, 'reject')} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50">
                    <X className="h-4 w-4" /> Reject with reason
                  </button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {error && <p role="alert" className="mt-3 break-words rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{message}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Approval/rejection ka record save hota hai. Sirf approved hajiri payroll mein count hogi.</p>
    </section>
  );
}
