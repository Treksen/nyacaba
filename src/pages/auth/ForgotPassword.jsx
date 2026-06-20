import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/ui/Logo';
import { CHURCH_NAME } from '../../lib/constants';

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return toast.error('Enter your email address');
    setSubmitting(true);
    const { error } = await sendPasswordReset(email.trim());
    setSubmitting(false);
    // For privacy we show the same confirmation whether or not the email exists,
    // so we don't reveal which emails are registered.
    if (error) {
      console.error("Password reset error:", error);
      toast.error(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-cream-50">
      <div className="max-w-md w-full mx-auto">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Logo size={36} />
          <h1 className="font-display text-2xl">{CHURCH_NAME} Welfare System</h1>
        </div>

        {sent ? (
          <div className="card-padded text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
              <CheckCircle2 size={26}/>
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">Check your email</h2>
            <p className="text-sm text-ink-600 mb-6">
              If an account exists for <strong>{email}</strong>, we've sent a link to reset
              your password. It may take a minute to arrive — check your spam folder too.
            </p>
            <Link to="/login" className="btn-primary w-full justify-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="card-padded">
            <p className="kicker mb-2">Forgot Password</p>
            <h2 className="font-display text-3xl font-semibold mb-2">Reset your password</h2>
            <p className="text-sm text-ink-600 mb-6">
              Enter the email you registered with and we'll send you a link to set a new password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="email"
                    required
                    autoFocus
                    className="input pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
              <ArrowLeft size={14}/> Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
