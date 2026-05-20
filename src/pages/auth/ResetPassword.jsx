import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/ui/Logo';
import { CHURCH_NAME } from '../../lib/constants';

/**
 * Reached by clicking the reset link in the email. Supabase puts a recovery
 * session in place (via the URL hash) before this renders, so updateUser can
 * set the new password directly.
 */
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(true);

  // Confirm we actually have a recovery session before letting them set a password
  useEffect(() => {
    let active = true;
    // Supabase fires PASSWORD_RECOVERY once the recovery token in the URL is processed
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { if (active) { setReady(true); setValidLink(true); } }
    });
    // Also check if a session is already present (link processed before listener attached)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) setReady(true);
      else {
        // Give the hash a moment; if still nothing, the link was bad/expired
        setTimeout(() => { if (active) { setReady(true); setValidLink(!!supabase.auth.getSession); } }, 800);
      }
    });
    return () => { active = false; sub?.subscription?.unsubscribe(); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (password !== confirm) return toast.error('Passwords do not match');
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      if (error.message?.toLowerCase().includes('session')) {
        toast.error('This reset link has expired. Please request a new one.');
        setValidLink(false);
      } else {
        toast.error(error.message || 'Could not update password');
      }
    } else {
      setDone(true);
      // Sign out the temporary recovery session and send them to login
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 2500);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-cream-50">
      <div className="max-w-md w-full mx-auto">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Logo size={36} />
          <h1 className="font-display text-2xl">{CHURCH_NAME}</h1>
        </div>

        {done ? (
          <div className="card-padded text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
              <CheckCircle2 size={26}/>
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">Password updated</h2>
            <p className="text-sm text-ink-600">
              Your password has been changed. Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <div className="card-padded">
            <p className="kicker mb-2">Set New Password</p>
            <h2 className="font-display text-3xl font-semibold mb-2">Choose a new password</h2>
            <p className="text-sm text-ink-600 mb-6">
              Enter a new password for your account. Make it at least 8 characters.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password"
                    required
                    autoFocus
                    className="input pl-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="password"
                    required
                    className="input pl-10"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={submitting || !ready} className="btn-primary w-full justify-center">
                {submitting ? 'Updating…' : 'Update password'}
              </button>
              {!validLink && (
                <p className="text-sm text-rose-700 text-center">
                  This link is invalid or expired.{' '}
                  <a href="/forgot-password" className="underline">Request a new one</a>.
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
