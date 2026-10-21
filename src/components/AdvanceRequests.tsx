import { useCallback, useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchRequests, resolveRequest, type AdvanceRequest } from '@/services/requestService';

const rs = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Thekedar: kharchi requests from mazdoor waiting for a yes / no. */
export function AdvanceRequests({ workerId, onChanged }: { workerId?: string; onChanged?: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AdvanceRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await fetchRequests({ workerId, pendingOnly: true }));
  }, [workerId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const decide = async (req: AdvanceRequest, approve: boolean) => {
    setBusy(req.id);
    try {
      await resolveRequest(req, approve, user?.id);
      await load();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-saffron-200">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-saffron-500 text-white"><HandCoins className="h-6 w-6" /></span>
        <h2 className="text-base font-bold text-gray-900">{items.length} kharchi request</h2>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-concrete-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">{r.workerName ?? 'Mazdoor'} · {rs(r.amount)}</p>
                {r.note && <p className="truncate text-xs text-gray-500">{r.note}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button disabled={busy !== null} onClick={() => decide(r, true)} className="rounded-xl bg-green-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Do</button>
                <button disabled={busy !== null} onClick={() => decide(r, false)} className="rounded-xl bg-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">Mana</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
