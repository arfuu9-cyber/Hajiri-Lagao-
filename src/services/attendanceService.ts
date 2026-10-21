import { supabase } from './supabase';
import type { Attendance, AttendanceWithWorker, AttendanceStatus, DutyMultiplier } from '@/types/database';
import { getKolkataDateString, getKolkataDayBounds } from '@/utils/date';

/**
 * Count distinct workers who have attendance for today's Kolkata date.
 */
export async function countPresentToday(): Promise<number> {
  const today = getKolkataDateString();

  const { data, error } = await supabase
    .from('attendance')
    .select('worker_id, status, duty_multiplier, half_day')
    .eq('approval_status', 'approved')
    .eq('date', today);

  if (error) throw error;
  const presentIds = new Set((data ?? [])
    .filter((row) => row.status === 'present' || row.status === 'late')
    .filter((row) => Number(row.duty_multiplier ?? (row.half_day ? 0.5 : 1)) > 0)
    .map((row) => row.worker_id));
  return presentIds.size;
}

/**
 * Check whether a worker already has attendance for the given date
 * (defaults to today's Kolkata date).
 */
export async function hasAttendanceToday(
  workerId: string,
  dateStr: string = getKolkataDateString()
): Promise<boolean> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id')
    .eq('worker_id', workerId)
    .eq('date', dateStr)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

/**
 * Create an attendance record for a worker.
 * Checks for existing attendance first, then relies on the DB unique constraint.
 * Returns the attendance record, or throws a friendly duplicate error.
 */
export async function createAttendance(
  workerId: string,
  status: AttendanceStatus = 'present',
  dutyMultiplier: DutyMultiplier = 1
): Promise<Attendance> {
  const today = getKolkataDateString();

  const already = await hasAttendanceToday(workerId, today);
  if (already) {
    throw new AttendanceDuplicateError('Attendance already marked or requested for this worker today');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again to mark attendance.');

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError) throw profileError;

  const isThekedar = profile.role === 'thekedar';
  const isLabour = profile.role === 'labour';
  if (!isThekedar && !isLabour) {
    throw new Error('Only the linked thekedar or worker can create an attendance record.');
  }
  if (isLabour && (status !== 'present' || dutyMultiplier !== 1)) {
    throw new Error('A worker can request only their own full-day attendance. The thekedar verifies the duty.');
  }

  const now = new Date().toISOString();
  const approvalStatus = isThekedar ? 'approved' : 'pending';
  const { data, error } = await supabase
    .from('attendance')
    .insert({
      worker_id: workerId,
      date: today,
      status,
      duty_multiplier: dutyMultiplier,
      half_day: dutyMultiplier === 0.5,
      marked_by: authData.user.id,
      approval_status: approvalStatus,
      approved_by: isThekedar ? authData.user.id : null,
      approved_at: isThekedar ? now : null,
      rejection_reason: null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AttendanceDuplicateError('Attendance already marked or requested for this worker today');
    }
    throw error;
  }
  return data as Attendance;
}

export interface AttendanceApprovalItem {
  id: string;
  worker_id: string;
  date: string;
  time_in: string;
  duty_multiplier: number;
  marked_by: string | null;
  approval_status: 'pending' | 'rejected';
  rejection_reason: string | null;
  worker: { id: string; name: string; role: string; phone: string };
}

/** Return pending requests visible to the signed-in thekedar (RLS limits the team). */
export async function fetchPendingAttendanceApprovals(): Promise<AttendanceApprovalItem[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, worker_id, date, time_in, duty_multiplier, marked_by, approval_status, rejection_reason')
    .in('approval_status', ['pending', 'rejected'])
    .order('date', { ascending: false })
    .order('time_in', { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.worker_id))];
  if (!ids.length) return [];
  const { data: workers, error: workerError } = await supabase
    .from('workers')
    .select('id, name, role, phone')
    .in('id', ids);
  if (workerError) throw workerError;
  const byId = new Map((workers ?? []).map((worker) => [worker.id, worker]));
  return rows
    .filter((row) => byId.has(row.worker_id))
    .map((row) => ({
      ...row,
      duty_multiplier: Number(row.duty_multiplier ?? 1),
      worker: byId.get(row.worker_id) as { id: string; name: string; role: string; phone: string },
    }));
}

/** Only the linked thekedar can approve a pending request; the DB enforces this too. */
export async function approveAttendanceRequest(attendanceId: string, dutyMultiplier: DutyMultiplier = 1): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again.');
  const { data, error } = await supabase
    .from('attendance')
    .update({
      approval_status: 'approved',
      duty_multiplier: dutyMultiplier,
      half_day: dutyMultiplier === 0.5,
      approved_by: authData.user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', attendanceId)
    .in('approval_status', ['pending', 'rejected'])
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Request pehle hi review ho chuki hai. List refresh karke dobara check karein.');
}

/** Record a rejection reason so it can be discussed later by both parties. */
export async function rejectAttendanceRequest(attendanceId: string, reason: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Please sign in again.');
  const { data, error } = await supabase
    .from('attendance')
    .update({
      approval_status: 'rejected',
      approved_by: authData.user.id,
      approved_at: null,
      rejection_reason: reason.trim() || 'Not approved by thekedar',
    })
    .eq('id', attendanceId)
    .eq('approval_status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Request pehle hi review ho chuki hai. List refresh karke dobara check karein.');
}

/**
 * Custom error class for duplicate attendance, so the UI can show a friendly message.
 */
export class AttendanceDuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttendanceDuplicateError';
  }
}

/**
 * Fetch attendance history with worker info, grouped by date (newest first).
 * Returns up to `limit` records (default 200).
 */
export async function fetchAttendanceHistory(limit: number = 200): Promise<AttendanceWithWorker[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      worker_id,
      date,
      time_in,
      status,
      duty_multiplier,
      approval_status,
      marked_by,
      approved_by,
      approved_at,
      rejection_reason,
      updated_at
    `)
    .order('date', { ascending: false })
    .order('time_in', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const wmap = await loadWorkerMap((data ?? []).map((r: any) => r.worker_id));

  return (data ?? []).map((row: any) => ({
    id: row.id,
    worker_id: row.worker_id,
    date: row.date,
    time_in: row.time_in,
    time_out: row.time_out ?? null,
    status: row.status as AttendanceStatus,
    overtime_hours: Number(row.overtime_hours ?? 0),
    half_day: Boolean(row.half_day ?? false),
    duty_multiplier: Number(row.duty_multiplier ?? 1),
    site_id: row.site_id ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    photo_url: row.photo_url ?? null,
    approval_status: row.approval_status ?? 'approved',
    marked_by: row.marked_by ?? null,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    updated_at: row.updated_at ?? undefined,
    worker: (wmap.get(row.worker_id) ?? { id: row.worker_id, name: '-', role: '', phone: '' }) as any,
  }));
}

/**
 * Fetch all attendance records for a specific date.
 */
export async function fetchAttendanceByDate(dateStr: string): Promise<AttendanceWithWorker[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      worker_id,
      date,
      time_in,
      status,
      duty_multiplier,
      approval_status,
      marked_by,
      approved_by,
      approved_at,
      rejection_reason,
      updated_at
    `)
    .eq('date', dateStr)
    .order('time_in', { ascending: false });

  if (error) throw error;
  const wmap = await loadWorkerMap((data ?? []).map((r: any) => r.worker_id));

  return (data ?? []).map((row: any) => ({
    id: row.id,
    worker_id: row.worker_id,
    date: row.date,
    time_in: row.time_in,
    time_out: row.time_out ?? null,
    status: row.status as AttendanceStatus,
    overtime_hours: Number(row.overtime_hours ?? 0),
    half_day: Boolean(row.half_day ?? false),
    duty_multiplier: Number(row.duty_multiplier ?? 1),
    site_id: row.site_id ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    photo_url: row.photo_url ?? null,
    approval_status: row.approval_status ?? 'approved',
    marked_by: row.marked_by ?? null,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    updated_at: row.updated_at ?? undefined,
    worker: (wmap.get(row.worker_id) ?? { id: row.worker_id, name: '-', role: '', phone: '' }) as any,
  }));
}

async function loadWorkerMap(ids: string[]): Promise<Map<string, any>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from('workers').select('id, name, role, phone').in('id', unique);
  return new Map((data ?? []).map((w: any) => [w.id, w]));
}
