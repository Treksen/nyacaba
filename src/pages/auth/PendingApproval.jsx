import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hourglass, Mail, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/ui/Logo';
import { CHURCH_NAME } from '../../lib/constants';

export default function PendingApproval() {
  const { profile, isApproved, isRejected, signOut, refreshProfile, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
    } else if (isApproved) {
      navigate('/', { replace: true });
    }
  }, [session, isApproved, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="max-w-lg w-full">
        <div className="card-padded text-center">
          <div className="flex justify-center mb-4">
            <Logo size={56} />
          </div>
          <p className="kicker mb-2">{CHURCH_NAME}</p>

          {isRejected ? (
            <>
              <h1 className="font-display text-3xl font-semibold mb-3">
                Access not granted
              </h1>
              <p className="text-ink-600 mb-6">
                Your account was reviewed and not approved at this time. Please reach out
                to a church administrator if you believe this is a mistake.
              </p>
            </>
          ) : profile?.approval_status === 'inactive' ? (
            <>
              <h1 className="font-display text-3xl font-semibold mb-3">
                Account deactivated
              </h1>
              <p className="text-ink-600 mb-6">
                Your access to the system has been paused by an administrator. Please reach
                out to your church admin if you'd like to be reactivated.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-100 text-accent-700 mb-4 animate-pulse">
                <Hourglass size={26} strokeWidth={1.5} />
              </div>
              <h1 className="font-display text-3xl font-semibold mb-3">
                Awaiting approval
              </h1>
              <p className="text-ink-600 mb-2">
                Hi <span className="font-semibold text-ink-800">{profile?.full_name}</span> 👋
              </p>
              <p className="text-ink-600 mb-6 text-pretty">
                Your account has been created. An administrator will review and approve
                you shortly. You'll get access as soon as that happens — no need to register
                again.
              </p>
              <div className="bg-cream-100/70 border border-cream-200 rounded-xl p-4 text-left text-sm text-ink-700 mb-6">
                <div className="flex gap-2 items-start">
                  <Mail size={16} className="mt-0.5 text-primary-700 shrink-0" />
                  <p>
                    We'll notify you at <span className="font-semibold">{profile?.email}</span>{' '}
                    once you're approved.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={refreshProfile}
              className="btn-secondary"
            >
              <RefreshCw size={16} /> Check status
            </button>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="btn-ghost"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
