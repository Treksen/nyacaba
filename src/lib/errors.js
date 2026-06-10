import { supabase } from './supabase';

export const FRIENDLY_MESSAGE = 'Something went wrong. Please contact the administrator.';

/**
 * Map a Postgres / PostgREST / Supabase error to a friendly, actionable
 * message — one that's helpful to EVERY user (admin or member) because the
 * error is something they can fix themselves (e.g. duplicate entry).
 *
 * Returns null when the error isn't one we recognize as user-actionable;
 * the caller then falls back to the role-based generic message.
 */
function friendlyKnownMessage(err) {
  if (!err) return null;
  const code = err.code || '';
  const msg  = (err.message || '').toLowerCase();

  // ----- Postgres unique-violation: 23505 -----
  if (code === '23505') {
    // Contribution reference / M-Pesa code already used by this member
    if (msg.includes('idx_contributions_unique_member_ref')) {
      return 'You\'ve already recorded a contribution with this reference (M-Pesa code, receipt, etc.). Check your contributions list — it may already be there.';
    }
    // Membership number collision (rare — trigger-generated)
    if (msg.includes('membership_no')) {
      return 'A member with this membership number already exists.';
    }
    // Email already registered
    if (msg.includes('email')) {
      return 'That email is already in use. Try signing in instead, or use a different email.';
    }
    // Expense number collision
    if (msg.includes('expense_no')) {
      return 'An expense with this number already exists. Please try again in a moment.';
    }
    // SKU collision
    if (msg.includes('sku')) {
      return 'An inventory item with this SKU already exists. Choose a different SKU or leave it blank to auto-generate.';
    }
    // Generic 23505 fallback
    return 'This entry already exists. It may have been recorded already.';
  }

  // ----- Postgres foreign-key violation: 23503 -----
  if (code === '23503') {
    return 'A linked record is missing. Refresh the page and try again — if it persists, contact the administrator.';
  }

  // ----- Postgres check-constraint: 23514 -----
  if (code === '23514') {
    return 'One of the values entered isn\'t allowed. Please review the form and try again.';
  }

  // ----- Postgres not-null: 23502 -----
  if (code === '23502') {
    return 'Please fill in all required fields.';
  }

  // ----- Postgres RLS denial: 42501 -----
  if (code === '42501') {
    return 'You don\'t have permission to do this. If you think this is a mistake, contact the administrator.';
  }

  // ----- PostgREST no-rows-found: PGRST116 -----
  if (code === 'PGRST116') {
    return 'The record you\'re looking for could not be found. It may have been removed.';
  }

  return null;
}

/**
 * Format any error into a string suitable for showing the user.
 *
 * Logic order:
 *   1. If it's a known/recognizable error → return a friendly, actionable
 *      message that EVERYONE sees (members included), because it's something
 *      they can act on themselves.
 *   2. Otherwise: admins see the raw technical message + Postgres code (for
 *      diagnostics); everyone else sees "Contact administrator."
 */
export function formatErrorMessage(err, isAdmin) {
  if (!err) return isAdmin ? 'Unknown error' : FRIENDLY_MESSAGE;
  if (typeof err === 'string') return isAdmin ? err : FRIENDLY_MESSAGE;

  // 1) Known, user-actionable errors — show to everyone
  const known = friendlyKnownMessage(err);
  if (known) {
    // Admin still gets the technical detail appended so they can diagnose
    if (isAdmin) {
      const code = err.code ? ` [${err.code}]` : '';
      const raw  = err.message ? ` — ${err.message}` : '';
      return `${known}${code}${raw}`;
    }
    return known;
  }

  // 2) Unknown errors — admin sees raw, others see generic
  const message = err.message || err.toString();
  if (!isAdmin) return FRIENDLY_MESSAGE;
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
    // Don't log "known/user-fixable" errors — they're just normal validation
    // outcomes (e.g. duplicate M-Pesa code), not engineering bugs. Reduces
    // noise in the admin error log.
    if (friendlyKnownMessage(err)) return;

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
    // eslint-disable-next-line no-console
    console.error('Failed to log error to error_logs:', logErr, 'original:', err);
  }
}
