import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, profile, loading, isAdmin, isApproved } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <LoadingSpinner label="Refreshing…" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <LoadingSpinner label="Setting up your profile…" />
      </div>
    );
  }

  if (!isApproved) {
    return <Navigate to="/pending" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
