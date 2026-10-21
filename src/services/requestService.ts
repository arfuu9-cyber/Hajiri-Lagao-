import { supabase } from '@/services/supabase';
import { createAdvance } from '@/services/payrollService';
import { getKolkataDateString } from '@/utils/date';

export interface AdvanceRequest {
  id: string;
  worker_id: string;
  amount: number;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  workerName?: string;
}

/** Mazdoor asks his thekedar for kharchi. */
export async function createAdvanceRequest(workerId: string, amount: number, note: string): Promise<void> {
  const { error } = await supabase
    .from('advance_requests')
    .insert({ worker_id: workerId, amount, note: note.trim() || null, status: 'pending' });
  if (error) throw error;
}

export async function fetchRequests(opts: { workerId?: string; pendingOnly?: boolean } = {}): Promise<AdvanceRequest[]> {
  let query = supabase
    .from('advance_requests')
    .select('id, worker_id, amount, note, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (opts.workerId) query = query.eq('worker_id', opts.workerId);
  if (opts.pendingOnly) query = query.eq('status', 'pending');
  const { data, error } = await query;
  if (error) return []; // table not created yet -> no requests
  const rows = (data ?? []) as AdvanceRequest[];
  if (rows.length === 0) return rows;
  const { data: ws } = await supabase.from('workers').select('id, name').in('id', [...new Set(rows.map((r) => r.worker_id))]);
  const names = new Map((ws ?? []).map((w: any) => [w.id, w.name]));
  return rows.map((r) => ({ ...r, amount: Number(r.amount), workerName: names.get(r.worker_id) ?? 'Mazdoor' }));
}

/** Thekedar says yes (kharchi is written in the khata) or no. */
export async function resolveRequest(req: AdvanceRequest, approve: boolean, givenBy?: string): Promise<void> {
  if (approve) {
    await createAdvance({
      workerId: req.worker_id,
      amount: req.amount,
      date: getKolkataDateString(),
      note: req.note ? `Request: ${req.note}` : 'Request',
      givenBy,
    });
  }
  const { error } = await supabase
    .from('advance_requests')
    .update({ status: approve ? 'approved' : 'rejected' })
    .eq('id', req.id);
  if (error) throw error;
}

export const createRequest = createAdvanceRequest;
