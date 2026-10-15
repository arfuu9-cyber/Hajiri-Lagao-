import { supabase } from './supabase';
import type { Worker, WorkerInput } from '@/types/database';
import { getKolkataDateString, getKolkataDayBounds } from '@/utils/date';

/**
 * Upload a profile photo for a worker to the worker-photos storage bucket.
 * Returns the public URL of the uploaded photo, or null if upload fails.
 */
export async function uploadWorkerPhoto(file: Blob, workerName: string): Promise<string | null> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const fileName = `${Date.now()}-${workerName.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
  const filePath = `profiles/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('worker-photos')
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Fetch all workers, sorted newest first.
 */
export async function fetchWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Search workers by name or phone number.
 */
export async function searchWorkers(query: string): Promise<Worker[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return fetchWorkers();
  }

  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a new worker in the database.
 */
export async function createWorker(input: WorkerInput): Promise<Worker> {
  const { data, error } = await supabase
    .from('workers')
    .insert({
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role.trim(),
      daily_wage: input.daily_wage,
      age: input.age ?? null,
      profile_photo_url: input.profile_photo_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Assign or update an NFC tag UID for a worker.
 * Returns the updated worker record.
 */
export async function assignNfcTag(workerId: string, nfcTagUid: string): Promise<Worker> {
  const normalizedUid = nfcTagUid.trim();

  // Check if this UID is already assigned to a different worker
  const { data: existing, error: checkError } = await supabase
    .from('workers')
    .select('id, name')
    .eq('nfc_tag_uid', normalizedUid)
    .neq('id', workerId)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    throw new Error(
      `This card is already assigned to ${existing.name}. Reassign it from that worker first.`
    );
  }

  const { data, error } = await supabase
    .from('workers')
    .update({ nfc_tag_uid: normalizedUid })
    .eq('id', workerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove the NFC tag assignment from a worker.
 */
export async function removeNfcTag(workerId: string): Promise<Worker> {
  const { data, error } = await supabase
    .from('workers')
    .update({ nfc_tag_uid: null })
    .eq('id', workerId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Find a worker by their NFC tag UID.
 */
export async function findWorkerByNfcUid(nfcTagUid: string): Promise<Worker | null> {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('nfc_tag_uid', nfcTagUid.trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Count workers created during the current Kolkata calendar day.
 */
export async function countNewWorkersToday(): Promise<number> {
  const { start, end } = getKolkataDayBounds();

  const { count, error } = await supabase
    .from('workers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lte('created_at', end);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Get the current Kolkata date string (exposed for convenience).
 */
export function getTodayDate(): string {
  return getKolkataDateString();
}
