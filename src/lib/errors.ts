/**
 * Extracts a human-readable message from a thrown value.
 *
 * Supabase's own error types are inconsistent about this: AuthError extends
 * Error, but PostgrestError (thrown by `.rpc()` and query builders) and
 * FunctionsError are plain objects with a `message` field that are *not*
 * `instanceof Error`. A bare `err instanceof Error` check silently drops
 * their message and falls back to a generic one, hiding the real cause.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message
  }
  return fallback
}
