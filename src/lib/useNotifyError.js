import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatErrorMessage, logError } from './errors';

/**
 * useNotifyError — the right way to report an error in this app.
 *
 *   const notifyError = useNotifyError();
 *   ...
 *   const { error } = await supabase.from('x').insert(...);
 *   if (error) return notifyError(error, { action: 'create_x' });
 *
 * What it does:
 *   1. Shows a toast — admin sees the raw technical message + error code;
 *      everyone else sees "Something went wrong. Please contact the
 *      administrator."
 *   2. Writes the error to the error_logs table for admin review at
 *      /admin/errors — regardless of who saw the toast.
 *
 * The `context` arg is freeform JSON used for diagnostics. Recommended
 * keys: action, entity_id, form_field.
 */
export function useNotifyError() {
  const { isAdmin, profile } = useAuth();
  const toast = useToast();

  return useCallback((err, context = {}) => {
    // Log async (fire-and-forget — we don't want to await before showing the toast)
    logError(err, { ...context, role: profile?.role });
    toast.error(formatErrorMessage(err, isAdmin));
  }, [isAdmin, profile?.role, toast]);
}
