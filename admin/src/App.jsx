import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Public
import Landing from './pages/Landing';

// Auth pages
import Login from './pages/auth/Login';

// Secretary
import SecretaryDashboard from './pages/secretary/Dashboard';
import SecretaryProfile from './pages/secretary/Profile';
import SecretaryResidence from './pages/secretary/Residence';
import SecretaryRequests from './pages/secretary/Requests';
import RequestRelease    from './pages/secretary/RequestRelease';

// Collector
import CollectorDashboard from './pages/collector/Dashboard';
import CollectorPayments  from './pages/collector/Payments';

// Barangay Captain
import CaptainDashboard  from './pages/captain/Dashboard';
import CaptainResidence  from './pages/captain/Residence';
import CaptainRequests   from './pages/captain/Requests';
import CaptainDocuments  from './pages/captain/Documents';
import CaptainReports    from './pages/captain/Reports';
import CaptainUsers      from './pages/captain/Users';

// Shared
import ProtectedRoute from './components/common/ProtectedRoute';
import Logs from './pages/logs/Logs';

const ROLE_HOME = {
  Secretary: '/secretary',
  Collector: '/collector',
  'Barangay Captain': '/captain',
};

export default function App() {
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to={ROLE_HOME[user.role] || '/secretary'} />}
      />

      {/* Secretary */}
      <Route element={<ProtectedRoute allowedRoles={['Secretary']} />}>
        <Route path="/secretary" element={<SecretaryDashboard />} />
        <Route path="/secretary/profile" element={<SecretaryProfile />} />
        <Route path="/secretary/residents" element={<SecretaryResidence />} />
        <Route path="/secretary/requests" element={<SecretaryRequests />} />
        <Route path="/secretary/releases" element={<RequestRelease />} />
        <Route path="/secretary/logs" element={<Logs />} />
      </Route>

      {/* Collector */}
      <Route element={<ProtectedRoute allowedRoles={['Collector']} />}>
        <Route path="/collector"          element={<CollectorDashboard />} />
        <Route path="/collector/payments" element={<CollectorPayments />} />
        <Route path="/collector/logs"     element={<Logs />} />
      </Route>

      {/* Barangay Captain */}
      <Route element={<ProtectedRoute allowedRoles={['Barangay Captain']} />}>
        <Route path="/captain"            element={<CaptainDashboard />} />
        <Route path="/captain/residents"  element={<CaptainResidence />} />
        <Route path="/captain/requests"   element={<CaptainRequests />} />
        <Route path="/captain/documents"  element={<CaptainDocuments />} />
        <Route path="/captain/reports"    element={<CaptainReports />} />
        <Route path="/captain/users"      element={<CaptainUsers />} />
        <Route path="/captain/logs"       element={<Logs />} />
      </Route>

      {/* Landing page */}
      <Route
        path="/"
        element={user ? <Navigate to={ROLE_HOME[user.role] || '/secretary'} /> : <Landing />}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
