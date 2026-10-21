/** Turns any thrown value (Supabase errors are plain objects) into readable text. */
export function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}
