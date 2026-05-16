import { supabase } from './supabase';

export const FRIENDLY_MESSAGE = 'Something went wrong. Please contact the administrator.';

/**
 * Format any error into a string suitable for showing the user.
 *
 * Admins see the full technical message + Postgres error code (if any),
 * which they can use to diagnose. Everyone else sees a short, generic
 * "Contact administrator" line so they're not confused by jargon like
 * "violates row-level security policy" or "PGRST116".
 */
export function formatErrorMessage(err, isAdmin) {
  if (!err) return isAdmin ? 'Unknown error' : FRIENDLY_MESSAGE;
  if (typeof err === 'string') return isAdmin ? err : FRIENDLY_MESSAGE;

  const message = err.message || err.toString();
  if (!isAdmin) return FRIENDLY_MESSAGE;

  // Admin view: include Postgres / PostgREST code if present
  if (err.code) return `[${err.code}] ${message}`;
  return message;
}

/**
 * Persist an error to the error_logs table for later review by admin.
 * Best-effort — failures here are intentionally swallowed so a bad
 * logging call never cascades into a worse user experience.
 */
export async function logError(err, context = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      user_id:    user?.id ?? null,
      user_role:  context.role ?? null,
      message:    err?.message || String(err).slice(0, 1000),
      code:       err?.code || null,
      details:    err?.details || null,
      hint:       err?.hint || null,
      stack:      err?.stack ? String(err.stack).slice(0, 4000) : null,
      route:      typeof window !== 'undefined' ? window.location.pathname : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      context:    context && Object.keys(context).length ? context : null,
    };

    await supabase.from('error_logs').insert(payload);
  } catch (logErr) {
    // Do not allow logging failures to cascade. Just console it.
    // eslint-disable-next-line no-console
    console.error('Failed to log error to error_logs:', logErr, 'original:', err);
  }
}
