import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifyError } from '../../lib/useNotifyError';
import Logo from '../../components/ui/Logo';
import { CHURCH_NAME } from '../../lib/constants';

export default function Login() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const notifyError = useNotifyError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [session, navigate, location]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      notifyError(error, { action: 'Login' });
    } else {
      toast.success('Welcome back!');
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: emerald panel with brand poetry */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-primary-900 text-cream-50 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent-400/15 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-primary-700/40 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #FAF7F2 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={42} />
            <p className="text-[11px] tracking-[0.24em] uppercase text-accent-300 font-semibold">
              Nyacaba Welfare Management System
            </p>
          </div>
        </div>

        <div className="relative max-w-2xl">
          <p className="kicker !text-accent-300 mb-4">A place to belong</p>
          <h2 className="font-display text-5xl xl:text-5xl leading-[1.05] tracking-tight mb-6">
            One Family.
            <br />
            <span className="text-accent-300 italic">
              One faithful ledger of care.
            </span>
            {/* <br /> */}
            {/* ledger of care. */}
          </h2>
          <p className="text-cream-100/80 text-lg leading-relaxed text-pretty">
            Track contributions, support members in need, manage projects and
            keep every shilling accountable — all in one home for {CHURCH_NAME}.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-cream-200/60">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
            Secure · Transparent · Built with care
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 bg-cream-50">
        <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
          <Logo size={36} />
          <h1 className="font-display text-1xl">{CHURCH_NAME}</h1>
        </div>
        <div className="max-w-md w-full mx-auto">
          <p className="kicker mb-2">Sign In</p>
          <h1 className="font-display text-4xl font-semibold mb-2">
            Welcome back
          </h1>
          <p className="text-ink-600 mb-8">
            Sign in to continue to your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="yourname@gmail.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-ink-600 text-center mt-8">
            New to {CHURCH_NAME}?{" "}
            <Link
              to="/register"
              className="text-primary-900 font-semibold hover:text-primary-700 underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
