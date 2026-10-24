import { supabase } from '@/services/supabase';

export interface AdvanceRequest {
  id: string;
  worker_id: string;
  amount: number;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  workerName?: string;
}

export interface AdvanceRequestReviewResult {
  status: 'approved' | 'rejected';
  advanceCreated: boolean;
}

/** Mazdoor asks only a linked thekedar for kharchi. The database RLS enforces ownership. */
export async function createAdvanceRequest(workerId: string, amount: number, note: string): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Kharchi ki rashi 0 se zyada honi chahiye.');
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
    .limit(50);
  if (opts.workerId) query = query.eq('worker_id', opts.workerId);
  if (opts.pendingOnly) query = query.eq('status', 'pending');
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AdvanceRequest[];
  if (rows.length === 0) return rows;

  const { data: ws, error: workerError } = await supabase
    .from('workers')
    .select('id, name')
    .in('id', [...new Set(rows.map((r) => r.worker_id))]);
  if (workerError) throw workerError;
  const names = new Map<string, string>();
  for (const worker of (ws ?? []) as { id: string; name: string }[]) names.set(worker.id, worker.name);
  return rows.map((r) => ({ ...r, amount: Number(r.amount), workerName: names.get(r.worker_id) ?? 'Mazdoor' }));
}

/**
 * Review is an atomic database RPC. An approved advance remains pending until the
 * signed-in worker confirms it in the app; no external SMS gateway is needed.
 */
export async function resolveRequest(
  req: AdvanceRequest,
  approve: boolean,
  note = '',
): Promise<AdvanceRequestReviewResult> {
  // Keep this argument order aligned with the repair migration's PostgREST RPC signature.
  const { data, error } = await supabase.rpc('review_advance_request', {
    p_approve: approve,
    p_note: note.trim() || null,
    p_request_id: req.id,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.result_request_id || row.result_status !== (approve ? 'approved' : 'rejected')) {
    throw new Error('Request ka status confirm nahi ho saka. Refresh karke check karein.');
  }
  return { status: row.result_status, advanceCreated: Boolean(row.result_advance_id) };
}

export const createRequest = createAdvanceRequest;
