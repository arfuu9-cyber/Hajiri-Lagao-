import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HandCoins, RefreshCw, XCircle } from 'lucide-react';
import { fetchRequests, resolveRequest, type AdvanceRequest } from '@/services/requestService';
import { errText } from '@/utils/errors';

const rs = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Thekedar's pending kharchi queue. A resolved request is removed immediately, not left on screen. */
export function AdvanceRequests({ workerId, onChanged }: { workerId?: string; onChanged?: () => void }) {
  const [items, setItems] = useState<AdvanceRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setLoadError('');
    try {
      setItems(await fetchRequests({ workerId, pendingOnly: true }));
    } catch (err) {
      setLoadError(errText(err) || 'Kharchi requests load nahi hui.');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(false); }, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const decide = async (req: AdvanceRequest, approve: boolean) => {
    setBusy(req.id);
    setActionError('');
    setNotice('');
    try {
      const result = await resolveRequest(req, approve);
      // Optimistically remove after the database transaction has confirmed the decision.
      setItems((current) => current.filter((item) => item.id !== req.id));
      if (!approve) {
        setNotice(`${req.workerName ?? 'Mazdoor'} ki kharchi request reject ho gayi aur list se hata di gayi.`);
      } else if (result.advanceCreated) {
        setNotice(`${req.workerName ?? 'Mazdoor'} ki kharchi approve ho gayi. Mazdoor apne account se app mein confirm karega; tab tak deduction nahi hogi.`);
      } else {
        setNotice('Request approve ho gayi, lekin kharchi record ID nahi mili. Hisaab refresh karke verify karein.');
      }
      onChanged?.();
      // Refresh other requests without bringing the completed request back into the UI.
      await load(false);
    } catch (err) {
      setActionError(errText(err) || 'Kharchi request update nahi hui.');
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0 && !loading && !loadError && !actionError && !notice) return null;
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-saffron-200">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-saffron-500 text-white"><HandCoins className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900">Kharchi requests</h2>
          <p className="text-xs text-gray-500">{items.length} pending</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh kharchi requests" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && <p className="mt-4 text-sm text-gray-500">Kharchi requests load ho rahi hain...</p>}
      {!loading && !loadError && items.length === 0 && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Abhi koi pending kharchi request nahi hai.</div>
      )}
      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl bg-concrete-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{r.workerName ?? 'Mazdoor'} · {rs(r.amount)}</p>
                  {r.note && <p className="mt-1 break-words text-xs text-gray-500">{r.note}</p>}
                  <p className="mt-1 text-[11px] text-gray-400">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => void decide(r, true)} className="rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === r.id ? '...' : 'Do'}</button>
                  <button type="button" disabled={busy !== null} onClick={() => void decide(r, false)} className="rounded-xl bg-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">Mana</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {loadError && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Requests load nahi hui: {loadError} <button onClick={() => void load()} className="ml-1 underline">Retry</button></div>}
      {actionError && <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700"><XCircle className="mr-1 inline h-4 w-4" />{actionError}</div>}
      {notice && <div role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">Approve karte hi request is list se hat jaati hai. Mazdoor apne account se kharchi confirm karega; confirmation tak payroll deduction nahi hogi.</p>
    </section>
  );
}
