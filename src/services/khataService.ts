import { supabase } from '@/services/supabase';

export interface KhataEntry {
  id: string;
  kind: 'haziri' | 'kharchi' | 'bhugtaan';
  date: string;
  amount: number;
  note?: string | null;
  pending?: boolean;
  disputed?: boolean;
}

export interface Khata {
  worker: { id: string; name: string; role: string; phone: string | null; daily_wage: number };
  days: number;
  earned: number;
  advances: number;
  paid: number;
  /** earned - advances - paid. Positive = thekedar still owes the mazdoor. */
  balance: number;
  entries: KhataEntry[];
}

/** One running account (khata) between a thekedar and a mazdoor. */
export async function fetchKhata(workerId: string): Promise<Khata> {
  const [w, att, adv, pay] = await Promise.all([
    supabase.from('workers').select('id, name, role, phone, daily_wage').eq('id', workerId).single(),
    supabase.from('attendance').select('id, date, status, half_day, duty_multiplier').eq('approval_status', 'approved').eq('worker_id', workerId),
    supabase.from('advances').select('id, amount, status, date, note').eq('worker_id', workerId),
    supabase.from('payments').select('id, amount, paid_on, note').eq('worker_id', workerId),
  ]);
  if (w.error) throw w.error;
  if (att.error) throw att.error;
  if (adv.error) throw adv.error;
  const wage = Number(w.data.daily_wage ?? 0);

  let days = 0;
  const entries: KhataEntry[] = [];
  (att.data ?? []).forEach((r: any) => {
    if (r.status !== 'present') return;
    const d = Number(r.duty_multiplier ?? (r.half_day ? 0.5 : 1));
    days += d;
    entries.push({ id: `a${r.id}`, kind: 'haziri', date: String(r.date), amount: d * wage, note: d === 1 ? 'Poora din' : `${d} din` });
  });
  (adv.data ?? []).forEach((a: any) =>
    entries.push({ id: `k${a.id}`, kind: 'kharchi', date: String(a.date), amount: Number(a.amount), note: a.note, pending: a.status === 'pending', disputed: a.status === 'disputed' })
  );
  // payments table may not exist yet -> treat as no payments
  (pay.error ? [] : pay.data ?? []).forEach((p: any) =>
    entries.push({ id: `b${p.id}`, kind: 'bhugtaan', date: String(p.paid_on), amount: Number(p.amount), note: p.note })
  );

  entries.sort((a, b) => b.date.localeCompare(a.date));
  const sum = (kind: KhataEntry['kind']) => entries.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
  const earned = sum('haziri');
  const advances = entries.filter((entry) => entry.kind === 'kharchi' && !entry.pending && !entry.disputed).reduce((total, entry) => total + entry.amount, 0);
  const paid = sum('bhugtaan');
  return { worker: w.data as Khata['worker'], days, earned, advances, paid, balance: earned - advances - paid, entries };
}
