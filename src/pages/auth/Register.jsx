import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNotifyError } from "../../lib/useNotifyError";
import Logo from "../../components/ui/Logo";
import { CHURCH_NAME } from "../../lib/constants";

// ── Validators ────────────────────────────────────────────────────────────────

const VALID_TLDS = [
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "co",
  "io",
  "info",
  "biz",
  "me",
  "ke",
  "ug",
  "tz",
  "rw",
  "et",
  "za",
  "ng",
  "gh",
  "us",
  "uk",
  "ca",
  "au",
  "de",
  "fr",
  "in",
  "app",
  "dev",
  "tech",
  "online",
  "site",
];

function validateEmail(email) {
  if (!email.trim()) return "Enter your email address";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Enter a valid email address";
  const tld = email.split(".").pop().toLowerCase();
  if (!VALID_TLDS.includes(tld)) {
    return `".${tld}" doesn't look like a valid email ending — did you make a typo?`;
  }
  return null;
}

function validatePhone(phone) {
  if (!phone.trim()) return null; // optional field
  const cleaned = phone.replace(/[\s\-]/g, "");
  const kenyanPhone = /^(\+2547\d{8}|\+2541\d{8}|07\d{8}|01\d{8})$/;
  if (!kenyanPhone.test(cleaned)) {
    return "Enter a valid Kenyan number e.g. 0712 345 678 or +254712345678";
  }
  return null;
}

// ── Field feedback helpers ─────────────────────────────────────────────────────

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle size={12} /> {message}
    </p>
  );
}

function FieldSuccess({ message }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
      <CheckCircle2 size={12} /> {message}
    </p>
  );
}

function StatusIcon({ error, valid }) {
  if (error) return <AlertCircle size={16} className="text-red-500" />;
  if (valid) return <CheckCircle2 size={16} className="text-emerald-500" />;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const notifyError = useNotifyError();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Track which fields have been blurred so we only show errors after interaction
  const [touched, setTouched] = useState({
    full_name: false,
    email: false,
    phone: false,
    password: false,
    confirm: false,
  });

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function touch(k) {
    setTouched((t) => ({ ...t, [k]: true }));
  }

  function touchAll() {
    setTouched({
      full_name: true,
      email: true,
      phone: true,
      password: true,
      confirm: true,
    });
  }

  // ── Derived validation state ──────────────────────────────────────────────

  const emailError = touched.email ? validateEmail(form.email) : null;
  const emailValid = touched.email && !validateEmail(form.email);

  const phoneError = touched.phone ? validatePhone(form.phone) : null;
  const phoneValid = touched.phone && form.phone && !validatePhone(form.phone);

  const passwordError =
    touched.password && form.password.length > 0 && form.password.length < 8
      ? "Password must be at least 8 characters"
      : null;
  const passwordValid = touched.password && form.password.length >= 8;

  const confirmError =
    touched.confirm && form.confirm && form.confirm !== form.password
      ? "Passwords do not match"
      : null;
  const confirmValid =
    touched.confirm &&
    form.confirm &&
    form.confirm === form.password &&
    passwordValid;

  const nameError =
    touched.full_name && !form.full_name.trim() ? "Enter your full name" : null;
  const nameValid = touched.full_name && !!form.full_name.trim();

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    touchAll();

    if (!form.full_name.trim()) return toast.error("Enter your full name");
    const emailErr = validateEmail(form.email);
    if (emailErr) return toast.error(emailErr);
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) return toast.error(phoneErr);
    if (form.password.length < 8)
      return toast.error("Password must be at least 8 characters");
    if (form.password !== form.confirm)
      return toast.error("Passwords do not match");

    setSubmitting(true);
    const { error } = await signUp(form.email, form.password, {
      full_name: form.full_name,
      phone: form.phone,
    });
    setSubmitting(false);

    if (error) {
      notifyError(error, { action: "Register" });
    } else {
      toast.success("Account created — pending admin approval");
      navigate("/pending");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-primary-900 text-cream-50 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent-400/15 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-primary-700/40 blur-3xl" />

        <div className="relative flex items-center gap-3 mb-2">
          <Logo size={42} />
          <p className="text-[11px] tracking-[0.24em] uppercase text-accent-300 font-semibold">
            Nyacaba Family Welfare Management System
          </p>
        </div>

        <div className="relative max-w-2xl">
          <p className="kicker !text-accent-300 mb-4">Karibu</p>
          <h2 className="font-display text-1xl xl:text-3xl leading-[1.05] tracking-tight mb-6">
            Join the
            <br />
            <span className="italic text-accent-300">
              {CHURCH_NAME} Welfare Management System
            </span>
          </h2>
          <p className="text-cream-100/80 text-lg leading-relaxed">
            New accounts go through a quick review. Once approved, you'll see
            your contributions, request welfare support, and stay close to the
            Family.
          </p>
        </div>

        <div className="relative text-xs text-cream-200/60" />
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 bg-cream-50">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
          <Logo size={36} />
          <h1 className="font-display text-2xl">{CHURCH_NAME}</h1>
        </div>

        <div className="max-w-md w-full mx-auto">
          <p className="kicker mb-2">Create Account</p>
          <h1 className="font-display text-4xl font-semibold mb-2">Join us</h1>
          <p className="text-ink-600 mb-8">
            Register, then wait for approval. You'll be notified when access
            opens.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label htmlFor="full_name" className="label">
                Full name
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  onBlur={() => touch("full_name")}
                  className={`input pl-10 pr-10 ${nameError ? "border-red-400 focus:ring-red-300" : ""}`}
                  placeholder="Your full name"
                />
                {touched.full_name && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <StatusIcon error={nameError} valid={nameValid} />
                  </span>
                )}
              </div>
              <FieldError message={nameError} />
            </div>

            {/* Email */}
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
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  onBlur={() => touch("email")}
                  className={`input pl-10 pr-10 ${emailError ? "border-red-400 focus:ring-red-300" : ""}`}
                  placeholder="you@gmail.com"
                />
                {touched.email && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <StatusIcon error={emailError} valid={emailValid} />
                  </span>
                )}
              </div>
              <FieldError message={emailError} />
              {emailValid && <FieldSuccess message="Looks good" />}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="label">
                Phone{" "}
                <span className="text-ink-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  onBlur={() => touch("phone")}
                  className={`input pl-10 pr-10 ${phoneError ? "border-red-400 focus:ring-red-300" : ""}`}
                  placeholder="+254 7XX XXX XXX"
                />
                {touched.phone && form.phone && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <StatusIcon error={phoneError} valid={phoneValid} />
                  </span>
                )}
              </div>
              <FieldError message={phoneError} />
              {phoneValid && <FieldSuccess message="Valid Kenyan number" />}
            </div>

            {/* Password + Confirm */}
            <div className="grid grid-cols-2 gap-3">
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
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    onBlur={() => touch("password")}
                    className={`input pl-10 pr-10 ${passwordError ? "border-red-400 focus:ring-red-300" : ""}`}
                    placeholder="At least 8 chars"
                  />
                  {touched.password && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <StatusIcon error={passwordError} valid={passwordValid} />
                    </span>
                  )}
                </div>
                <FieldError message={passwordError} />
              </div>

              <div>
                <label htmlFor="confirm" className="label">
                  Confirm
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={form.confirm}
                    onChange={(e) => update("confirm", e.target.value)}
                    onBlur={() => touch("confirm")}
                    className={`input pl-10 pr-10 ${confirmError ? "border-red-400 focus:ring-red-300" : ""}`}
                    placeholder="Re-enter"
                  />
                  {touched.confirm && form.confirm && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <StatusIcon error={confirmError} valid={confirmValid} />
                    </span>
                  )}
                </div>
                <FieldError message={confirmError} />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? (
                "Creating account…"
              ) : (
                <>
                  {" "}
                  Create account <ArrowRight size={16} />{" "}
                </>
              )}
            </button>
          </form>

          <p className="text-sm text-ink-600 text-center mt-8">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary-900 font-semibold hover:text-primary-700 underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
