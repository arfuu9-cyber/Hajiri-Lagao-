import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, HandCoins, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface PendingAdvance {
  id: string;
  worker_id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

const rs = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

/**
 * Authenticated in-app confirmation. The server-side RPC validates that the signed-in
 * account owns the worker row before changing any advance status.
 */
export function PendingAdvanceConfirmations({ workerId, onChanged }: { workerId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<PendingAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('list_my_pending_advances');
      if (rpcError) throw rpcError;
      const rows = ((data ?? []) as PendingAdvance[]).filter((item) => item.worker_id === workerId);
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pending kharchi load nahi ho saki.');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(false); }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const confirm = async (item: PendingAdvance) => {
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('confirm_advance_in_app', { p_advance_id: item.id });
      if (rpcError) throw rpcError;
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`${rs(Number(item.amount))} ki kharchi confirm ho gayi. Hisaab update ho gaya.`);
      setDisputeId(null);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kharchi confirm nahi ho saki. Dobara try karein.');
    } finally {
      setBusyId(null);
    }
  };

  const dispute = async (item: PendingAdvance) => {
    const reason = disputeReason.trim();
    if (reason.length < 4) {
      setError('Samasya ka chhota sa reason likhein (kam se kam 4 akshar).');
      return;
    }
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('dispute_advance_in_app', {
        p_advance_id: item.id,
        p_reason: reason,
      });
      if (rpcError) throw rpcError;
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice('Kharchi par aapki dikkat darj ho gayi. Iska deduction abhi nahi hoga; Thekedar se hisaab milayein.');
      setDisputeId(null);
      setDisputeReason('');
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dikkat darj nahi ho saki. Dobara try karein.');
    } finally {
      setBusyId(null);
    }
  };

  if (!loading && items.length === 0 && !error && !notice) return null;

  return (
    <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><HandCoins className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-slate-900">Kharchi confirm karein</h2>
          <p className="text-xs leading-5 text-slate-500">Apne linked account se kharchi ka hisaab confirm karein.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh pending advances" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">Kharchi check ho rahi hai…</p>}
      {!loading && items.length === 0 && error === '' && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Abhi koi kharchi confirmation pending nahi hai.</p>}

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-100"><HandCoins className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-black tracking-tight text-slate-900">{rs(Number(item.amount))}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.date}{item.note ? ` · ${item.note}` : ''}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">Sirf tab confirm karein jab aapne ye paise waqai liye hon.</p>
              </div>
            </div>
            {disputeId === item.id ? (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-bold text-slate-700" htmlFor={`dispute-${item.id}`}>Kya galat hai?</label>
                <textarea id={`dispute-${item.id}`} rows={2} maxLength={250} value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} placeholder="Jaise: paise nahi mile ya rashi galat hai" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
                <div className="flex gap-2">
                  <button type="button" disabled={busyId !== null} onClick={() => void dispute(item)} className="flex-1 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">Dikkat bhejein</button>
                  <button type="button" disabled={busyId !== null} onClick={() => { setDisputeId(null); setDisputeReason(''); setError(''); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={busyId !== null} onClick={() => void confirm(item)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> {busyId === item.id ? 'Save ho raha hai…' : 'Maine le li'}
                </button>
                <button type="button" disabled={busyId !== null} onClick={() => { setDisputeId(item.id); setDisputeReason(''); setError(''); }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50">
                  <CircleAlert className="h-4 w-4" /> Rashi galat hai
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700"><XCircle className="h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-4 w-4 shrink-0" />{notice}</p>}
    </section>
  );
}
