import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, HandCoins, IndianRupee, UserCheck, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchKhata, type Khata } from '@/services/khataService';
import { createAttendance, AttendanceDuplicateError } from '@/services/attendanceService';
import { createAdvance, recordPayment } from '@/services/payrollService';
import { createAdvanceRequest, fetchRequests, type AdvanceRequest } from '@/services/requestService';
import { AdvanceRequests } from '@/components/AdvanceRequests';
import { getKolkataDateString } from '@/utils/date';
import { errText } from '@/utils/errors';

const rs = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;

interface KhataScreenProps {
  workerId: string;
  onBack: () => void;
  /** true for the mazdoor himself: he can only look */
  readOnly?: boolean;
}

export function KhataScreen({ workerId, onBack, readOnly = false }: KhataScreenProps) {
  const { user } = useAuth();
  const [data, setData] = useState<Khata | null>(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<null | 'kharchi' | 'bhugtaan'>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [maango, setMaango] = useState(false);
  const [myReqs, setMyReqs] = useState<AdvanceRequest[]>([]);

  const load = useCallback(async () => {
    try {
      setData(await fetchKhata(workerId));
      if (readOnly) setMyReqs((await fetchRequests({ workerId })).slice(0, 3));
      setError('');
    } catch (err) {
      setError(errText(err));
    }
  }, [workerId, readOnly]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (job: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg('');
    try {
      await job();
      setPanel(null);
      setMaango(false);
      setAmount('');
      setNote('');
      await load();
      setMsg(ok);
    } catch (err) {
      setMsg(err instanceof AttendanceDuplicateError ? 'Aaj ki haziri pehle se lagi hai' : errText(err));
    } finally {
      setBusy(false);
    }
  };

  const today = getKolkataDateString();
  const submit = () => {
    const value = Number(amount);
    if (!value || value <= 0) return setMsg('Sahi rashi daalo');
    if (maango) {
      run(() => createAdvanceRequest(workerId, value, note), 'Request thekedar ko bhej di');
      return;
    }
    if (panel === 'kharchi') {
      run(() => createAdvance({ workerId, amount: value, date: today, note, givenBy: user?.id }).then(() => undefined), 'Kharchi likh li gayi');
    } else {
      run(() => recordPayment({ workerId, amount: value, range: { start: today, end: today }, note }), 'Bhugtaan likh liya gaya');
    }
  };

  const share = () => {
    if (!data) return;
    const text = [
      `*Hajiri Lagao - Khata*`,
      data.worker.name,
      `Din: ${data.days} | Kamai: ${rs(data.earned)}`,
      `Kharchi: ${rs(data.advances)} | Bhugtaan: ${rs(data.paid)}`,
      data.balance >= 0 ? `*Baaki: ${rs(data.balance)}*` : `*Zyada liya: ${rs(data.balance)}*`,
    ].join('\n');
    const digits = (data.worker.phone ?? '').replace(/\D/g, '');
    const number = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (error && !data) {
    return (
      <div className="min-h-screen bg-concrete-50 p-6">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 font-semibold text-gray-700"><ArrowLeft className="h-5 w-5" /> Wapas</button>
        <p className="font-semibold text-gray-900">Khata load nahi hua.</p>
        <p className="mt-2 break-words text-xs text-gray-400">{error}</p>
        <button onClick={load} className="mt-4 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold">Try Again</button>
      </div>
    );
  }
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-concrete-50 text-gray-500">Load ho raha hai...</div>;

  const { worker, balance } = data;
  const owes = balance > 0;
  return (
    <div className="min-h-screen bg-concrete-50 pb-10">
      <div className="bg-gradient-to-br from-navy-500 to-navy-800 px-5 pb-8 pt-5 text-white">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-100"><ArrowLeft className="h-5 w-5" /> Wapas</button>
        <h1 className="text-2xl font-extrabold">{worker.name}</h1>
        <p className="text-sm text-navy-100">{worker.role} · {rs(worker.daily_wage)} / din</p>
        <div className="mt-5 rounded-3xl bg-white/15 p-5">
          <p className="text-sm text-navy-100">
            {balance === 0 ? 'Hisaab barabar' : owes ? (readOnly ? 'Thekedar se milna baaki' : 'Mazdoor ko dena baaki') : (readOnly ? 'Aapne zyada liya' : 'Mazdoor ne zyada liya')}
          </p>
          <p className="mt-1 text-4xl font-extrabold">{rs(balance)}</p>
        </div>
      </div>

      <div className="-mt-4 grid grid-cols-3 gap-3 px-4">
        {[['Kamai', rs(data.earned), `${data.days} din`], ['Kharchi', rs(data.advances), 'liya'], ['Bhugtaan', rs(data.paid), 'mila']].map(([a, b, c]) => (
          <div key={a} className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-navy-100">
            <p className="text-[11px] text-gray-500">{a}</p>
            <p className="text-base font-extrabold text-gray-900">{b}</p>
            <p className="text-[11px] text-gray-400">{c}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 px-4 pt-5">
        {!readOnly ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <button disabled={busy} onClick={() => run(() => createAttendance(workerId, 'present').then(() => undefined), 'Aaj ki haziri lag gayi')} className="rounded-2xl bg-green-500 py-3 text-sm font-bold text-white disabled:opacity-50">Haziri</button>
              <button onClick={() => setPanel(panel === 'kharchi' ? null : 'kharchi')} className="rounded-2xl bg-saffron-500 py-3 text-sm font-bold text-white">Kharchi do</button>
              <button onClick={() => setPanel(panel === 'bhugtaan' ? null : 'bhugtaan')} className="rounded-2xl bg-navy-600 py-3 text-sm font-bold text-white">Bhugtaan</button>
            </div>
            {panel && (
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
                <p className="mb-2 text-sm font-bold text-gray-800">{panel === 'kharchi' ? 'Kitni kharchi di?' : 'Kitna bhugtaan kiya?'}</p>
                <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹ rashi" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg font-bold focus:border-navy-500 focus:outline-none" />
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (jaise: ration, bimari)" className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-navy-500 focus:outline-none" />
                <button disabled={busy} onClick={submit} className="mt-3 w-full rounded-2xl bg-navy-600 py-3 font-bold text-white disabled:opacity-50">{busy ? '...' : 'Likh do'}</button>
              </div>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setMaango((m) => !m)} className="w-full rounded-2xl bg-saffron-500 py-3 text-sm font-bold text-white">Kharchi maango</button>
            {maango && (
              <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
                <p className="mb-2 text-sm font-bold text-gray-800">Kitni kharchi chahiye?</p>
                <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹ rashi" className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg font-bold focus:border-navy-500 focus:outline-none" />
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kyun chahiye (jaise: ration, bimari)" className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-navy-500 focus:outline-none" />
                <button disabled={busy} onClick={submit} className="mt-3 w-full rounded-2xl bg-navy-600 py-3 font-bold text-white disabled:opacity-50">{busy ? '...' : 'Thekedar ko request bhejo'}</button>
              </div>
            )}
            {myReqs.map((r) => (
              <p key={r.id} className="rounded-xl bg-white px-4 py-2 text-xs text-gray-600 ring-1 ring-navy-100">
                Request {rs(r.amount)} · <b className={r.status === 'approved' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-600' : 'text-saffron-600'}>{r.status === 'approved' ? 'Manzoor' : r.status === 'rejected' ? 'Mana kiya' : 'Intezaar'}</b>
              </p>
            ))}
          </>
        )}
        {!readOnly && <AdvanceRequests workerId={workerId} onChanged={load} />}
        {msg && <p className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-800 ring-1 ring-navy-100">{msg}</p>}
        <button onClick={share} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-50 py-3 text-sm font-bold text-green-700 ring-1 ring-green-200"><MessageCircle className="h-4 w-4" /> Khata WhatsApp par bhejo</button>

        <h2 className="pt-3 text-base font-bold text-gray-900">Poora hisaab</h2>
        {data.entries.length === 0 && <p className="text-sm text-gray-500">Abhi koi entry nahi.</p>}
        <div className="space-y-2">
          {data.entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-navy-100">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${e.kind === 'haziri' ? 'bg-green-500' : e.kind === 'kharchi' ? 'bg-saffron-500' : 'bg-navy-600'}`}>
                {e.kind === 'haziri' ? <UserCheck className="h-5 w-5" /> : e.kind === 'kharchi' ? <HandCoins className="h-5 w-5" /> : <IndianRupee className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{e.kind === 'haziri' ? 'Haziri' : e.kind === 'kharchi' ? 'Kharchi li' : 'Bhugtaan mila'}{e.note ? ` · ${e.note}` : ''}</p>
                <p className="flex items-center gap-1 text-xs text-gray-500">{e.date}{e.disputed && <span className="text-rose-600">· Hisaab par dikkat darj</span>}{e.pending && !e.disputed && <span className="text-saffron-600">· Mazdoor confirmation pending</span>}{e.kind === 'haziri' && <CheckCircle2 className="h-3 w-3 text-green-500" />}</p>
              </div>
              <p className={`text-sm font-extrabold ${e.kind === 'haziri' ? 'text-green-600' : 'text-gray-800'}`}>{e.kind === 'haziri' ? '+' : '−'}{rs(e.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
