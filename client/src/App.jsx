import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Public
import Landing from './pages/Landing';

// Auth pages
import Login from './pages/auth/Login';

// Secretary
import SecretaryDashboard from './pages/secretary/Dashboard';

// Collector
import CollectorDashboard from './pages/collector/Dashboard';

// Barangay Captain
import CaptainDashboard from './pages/captain/Dashboard';

// Shared
import ProtectedRoute from './components/common/ProtectedRoute';

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
      </Route>

      {/* Collector */}
      <Route element={<ProtectedRoute allowedRoles={['Collector']} />}>
        <Route path="/collector" element={<CollectorDashboard />} />
      </Route>

      {/* Barangay Captain */}
      <Route element={<ProtectedRoute allowedRoles={['Barangay Captain']} />}>
        <Route path="/captain" element={<CaptainDashboard />} />
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
