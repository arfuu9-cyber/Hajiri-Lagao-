import { supabase } from './supabase';
import type { Attendance, AttendanceWithWorker, AttendanceStatus, DutyMultiplier } from '@/types/database';
import { getKolkataDateString, getKolkataDayBounds } from '@/utils/date';

/**
 * Count distinct workers who have attendance for today's Kolkata date.
 */
export async function countPresentToday(): Promise<number> {
  const today = getKolkataDateString();

  const { count, error } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('date', today);

  if (error) throw error;
  return count ?? 0;
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

  // Pre-check: avoid hitting the DB constraint if we can
  const already = await hasAttendanceToday(workerId, today);
  if (already) {
    throw new AttendanceDuplicateError('Attendance already marked for this worker today');
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      worker_id: workerId,
      date: today,
      status,
      duty_multiplier: dutyMultiplier,
      half_day: dutyMultiplier === 0.5,
    })
    .select()
    .single();

  if (error) {
    // Handle the unique constraint violation (23505) as a friendly duplicate message
    if (error.code === '23505') {
      throw new AttendanceDuplicateError(
        'Attendance already marked for this worker today'
      );
    }
    throw error;
  }

  return data;
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
      worker:workers (
        id,
        name,
        role,
        phone
      )
    `)
    .order('date', { ascending: false })
    .order('time_in', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Flatten the worker relationship into the expected shape
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
    worker: row.worker,
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
      worker:workers (
        id,
        name,
        role,
        phone
      )
    `)
    .eq('date', dateStr)
    .order('time_in', { ascending: false });

  if (error) throw error;

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
    worker: row.worker,
  }));
}
