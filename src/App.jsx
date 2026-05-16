import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoadingSpinner from './components/ui/LoadingSpinner';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PendingApproval from './pages/auth/PendingApproval';

import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

import Dashboard from './pages/Dashboard';
import MembersList from './pages/members/MembersList';
import MemberDetail from './pages/members/MemberDetail';
import MemberForm from './pages/members/MemberForm';
import ContributionsList from './pages/contributions/ContributionsList';
import ContributionForm from './pages/contributions/ContributionForm';
import PledgesList from './pages/contributions/PledgesList';
import MemberStatement from './pages/contributions/MemberStatement';
import WelfareList from './pages/welfare/WelfareList';
import WelfareRequestForm from './pages/welfare/WelfareRequestForm';
import WelfareDetail from './pages/welfare/WelfareDetail';
import InventoryList from './pages/inventory/InventoryList';
import InventoryItemPage from './pages/inventory/InventoryItemPage';
import MeetingsList from './pages/meetings/MeetingsList';
import MeetingDetail from './pages/meetings/MeetingDetail';
import ProjectsList from './pages/projects/ProjectsList';
import ProjectDetail from './pages/projects/ProjectDetail';
import NotificationsList from './pages/notifications/NotificationsList';
import AnnouncementsList from './pages/announcements/AnnouncementsList';
import Reports from './pages/reports/Reports';
import Profile from './pages/settings/Profile';
import AdminPanel from './pages/settings/AdminPanel';
import LookupsPanel from './pages/admin/LookupsPanel';
import AuditLog from './pages/admin/AuditLog';
import ErrorLogs from './pages/admin/ErrorLogs';
import MyGiving from './pages/MyGiving';
import ContributionReceipt from './pages/contributions/ContributionReceipt';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { loading, session } = useAuth();

  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <LoadingSpinner label="Loading…" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={<PendingApproval />} />

      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<MembersList />} />
        <Route path="/members/new" element={<MemberForm />} />
        <Route path="/members/:id" element={<MemberDetail />} />
        <Route path="/members/:id/edit" element={<MemberForm />} />

        <Route path="/contributions" element={<ContributionsList />} />
        <Route path="/contributions/new" element={<ContributionForm />} />
        <Route path="/pledges" element={<PledgesList />} />
        <Route path="/statements/:memberId" element={<MemberStatement />} />

        <Route path="/welfare" element={<WelfareList />} />
        <Route path="/welfare/new" element={<WelfareRequestForm />} />
        <Route path="/welfare/:id" element={<WelfareDetail />} />

        <Route path="/inventory" element={<InventoryList />} />
        <Route path="/inventory/:id" element={<InventoryItemPage />} />

        <Route path="/meetings" element={<MeetingsList />} />
        <Route path="/meetings/:id" element={<MeetingDetail />} />

        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />

        <Route path="/announcements" element={<AnnouncementsList />} />
        <Route path="/notifications" element={<NotificationsList />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/lookups" element={<LookupsPanel />} />
        <Route path="/admin/audit" element={<AuditLog />} />
        <Route path="/admin/errors" element={<ErrorLogs />} />
        <Route path="/my-giving" element={<MyGiving />} />
        <Route path="/receipt/:id" element={<ContributionReceipt />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  );
}
