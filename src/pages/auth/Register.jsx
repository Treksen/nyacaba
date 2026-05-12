import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/ui/Logo';
import { CHURCH_NAME } from '../../lib/constants';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return toast.error('Passwords do not match');
    }
    if (form.password.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setSubmitting(true);
    const { error } = await signUp(form.email, form.password, {
      full_name: form.full_name,
      phone: form.phone,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Could not register');
    } else {
      toast.success('Account created — pending admin approval');
      navigate('/pending');
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-primary-900 text-cream-50 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent-400/15 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-primary-700/40 blur-3xl" />
        <div className="relative flex items-center gap-3 mb-2">
          <Logo size={42} />
          <p className="text-[11px] tracking-[0.24em] uppercase text-accent-300 font-semibold">
           Nyacaba Family Welfare Management System
          </p>
        </div>

        <div className="relative max-w-lg">
          <p className="kicker !text-accent-300 mb-4">Karibu</p>
          <h2 className="font-display text-5xl xl:text-6xl leading-[1.05] tracking-tight mb-6">
            Join the
            <br />
            <span className="italic text-accent-300">{CHURCH_NAME}</span>
          </h2>
          <p className="text-cream-100/80 text-lg leading-relaxed">
            New accounts go through a quick admin review. Once approved, you'll see
            your contributions, request welfare support, and stay close to the
            community.
          </p>
        </div>

        <div className="relative text-xs text-cream-200/60">
          {/* Tip: the very first account to register becomes the system's first admin. */}
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 bg-cream-50">
        <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
          <Logo size={36} />
          <h1 className="font-display text-2xl">{CHURCH_NAME}</h1>
        </div>
        <div className="max-w-md w-full mx-auto">
          <p className="kicker mb-2">Create Account</p>
          <h1 className="font-display text-4xl font-semibold mb-2">Join us</h1>
          <p className="text-ink-600 mb-8">
            Register, then wait for admin approval. You'll be notified when access opens.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="label">Full name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                  className="input pl-10"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="input pl-10"
                  placeholder="you@gmail.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="label">Phone (optional)</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="input pl-10"
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    className="input pl-10"
                    placeholder="At least 8 chars"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirm" className="label">Confirm</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.confirm}
                  onChange={(e) => update('confirm', e.target.value)}
                  className="input"
                  placeholder="Re-enter"
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
              {submitting ? 'Creating account…' : (
                <>
                  Create account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-ink-600 text-center mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-900 font-semibold hover:text-primary-700 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
