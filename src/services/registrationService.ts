import { supabase } from '@/services/supabase';
import type { UserRole } from '@/types/database';

export type AccountRegistrationRole = Extract<UserRole, 'thekedar' | 'gatekeeper'>;

interface AccountRegistrationResult {
  profile_id: string;
  worker_id: string;
  role: AccountRegistrationRole;
  display_name: string;
  phone: string;
}

function firstRow(value: unknown): AccountRegistrationResult | null {
  if (Array.isArray(value)) return (value[0] as AccountRegistrationResult | undefined) ?? null;
  return value ? (value as AccountRegistrationResult) : null;
}

/**
 * Registers a Thekedar/Gatekeeper profile and its own workers-table row atomically.
 * The database function is idempotent, so retrying after a timeout does not make duplicates.
 */
export async function registerAccountWithRole(input: {
  displayName: string;
  phone: string;
  role: AccountRegistrationRole;
}): Promise<AccountRegistrationResult> {
  const displayName = input.displayName.trim();
  const phone = input.phone.trim();

  if (displayName.length < 2 || displayName.length > 100) {
    throw new Error('Naam 2 se 100 characters ke beech hona chahiye.');
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Valid phone number daalein (7–15 digits).');
  }

  const { data, error } = await supabase.rpc('register_account_with_role', {
    p_display_name: displayName,
    p_phone: phone,
    p_role: input.role,
  });

  if (error) {
    const message = error.message || 'Registration save nahi ho saki.';
    if (/function .*register_account_with_role.* does not exist|schema cache/i.test(message)) {
      throw new Error('Supabase mein account-registration SQL abhi run nahi hua. ZIP ke SETUP_HINDI.md mein diya SQL/migration apply karein.');
    }
    throw new Error(message);
  }

  const row = firstRow(data);
  if (!row?.profile_id || !row?.worker_id) {
    throw new Error('Server ne registration confirm nahi ki. Internet check karke dobara try karein.');
  }
  return row;
}
