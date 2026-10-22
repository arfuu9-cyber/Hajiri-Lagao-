import { supabase } from '@/services/supabase';

export type ConnectionStatus = 'pending' | 'approved' | 'rejected';

export interface TeamConnectionRequest {
  request_id: string;
  worker_id: string;
  thekedar_id: string;
  requested_by: string;
  status: ConnectionStatus;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  worker_name: string;
  worker_role: string;
  thekedar_name: string;
  requester_name: string;
  worker_phone: string | null;
  requester_phone: string | null;
}

export interface ConnectionRequestResult {
  request_id: string | null;
  worker_name: string;
  thekedar_name: string;
  status: ConnectionStatus;
}

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value ? (value as T) : null;
}

/** A code never links accounts by itself: it only creates a request for contractor approval. */
export async function requestTeamConnection(code: string): Promise<ConnectionRequestResult> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    throw new Error('6-character invite code daalo.');
  }
  const { data, error } = await supabase.rpc('request_team_connection', { p_code: normalized });
  if (error) throw error;
  const row = firstRow<ConnectionRequestResult>(data);
  if (!row) throw new Error('Request create nahi hui. Code dobara check karo.');
  return row;
}

/** Contractor sees incoming requests; labour sees only their own connection-request history. */
export async function fetchTeamConnectionRequests(): Promise<TeamConnectionRequest[]> {
  const { data, error } = await supabase.rpc('list_my_team_connection_requests');
  if (error) throw error;
  return (data ?? []) as TeamConnectionRequest[];
}

export async function reviewTeamConnectionRequest(
  requestId: string,
  approve: boolean,
  note = '',
): Promise<void> {
  const { error } = await supabase.rpc('review_team_connection', {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note.trim() || null,
  });
  if (error) throw error;
}

export function getInviteQrPayload(code: string): string {
  return `HAJIRI-WORKER:${code.trim().toUpperCase()}`;
}

export function extractInviteCode(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  const direct = value.match(/^([A-Z0-9]{6})$/);
  if (direct) return direct[1];
  const prefixed = value.match(/HAJIRI[-_]WORKER\s*[:/| ]\s*([A-Z0-9]{6})/);
  if (prefixed) return prefixed[1];
  try {
    const url = new URL(raw.trim());
    const queryCode = (url.searchParams.get('code') ?? url.searchParams.get('invite') ?? '').toUpperCase();
    return /^[A-Z0-9]{6}$/.test(queryCode) ? queryCode : null;
  } catch {
    return null;
  }
}

