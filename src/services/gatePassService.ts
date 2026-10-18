import { supabase } from './supabase';
import type { GatePass } from '@/types/database';
import { createAttendance, AttendanceDuplicateError } from './attendanceService';
import { getKolkataDateString } from '@/utils/date';

/**
 * Record a gate pass entry and mark attendance for all associated workers.
 */
export async function createGatePass(
  thekedarId: string,
  workerIds: string[]
): Promise<GatePass> {
  const { data, error } = await supabase
    .from('gate_passes')
    .insert({
      thekedar_id: thekedarId,
      worker_ids: workerIds,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark attendance for a batch of workers, skipping duplicates.
 * Returns the count of newly-marked workers.
 */
export async function markBatchAttendance(workerIds: string[]): Promise<number> {
  let marked = 0;
  for (const workerId of workerIds) {
    try {
      await createAttendance(workerId, 'present');
      marked++;
    } catch (err) {
      if (err instanceof AttendanceDuplicateError) continue;
      throw err;
    }
  }
  return marked;
}

/**
 * Fetch workers associated with a Thekedar.
 * Currently returns all active workers since we don't have a thekedar-worker link table.
 * In future, a `thekedar_id` column on workers could filter this.
 */
export async function fetchThekedarWorkers(thekedarId: string) {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export { getKolkataDateString };
