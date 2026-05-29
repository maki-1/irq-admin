import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Guards
import PrivateRoute from './components/guards/PrivateRoute';
import VerifiedRoute from './components/guards/VerifiedRoute';
import UnverifiedRoute from './components/guards/UnverifiedRoute';

// Public pages
import Login from './pages/public/Login';
import Signup from './pages/public/Signup';
import Otp from './pages/public/Otp';
import ForgotPassword from './pages/public/ForgotPassword';
import ResetPassword from './pages/public/ResetPassword';

// Verification pages
import Step1 from './pages/verify/Step1';
import Step2 from './pages/verify/Step2';
import Step3 from './pages/verify/Step3';
import Waiting from './pages/verify/Waiting';

// Protected pages
import Dashboard from './pages/protected/Dashboard';
import Requests from './pages/protected/Requests';
import NewRequest from './pages/protected/NewRequest';

// Account
import Profile from './pages/account/Profile';

// Payment
import PaymentSuccess from './pages/payment/Success';
import PaymentCancel from './pages/payment/Cancel';

export default function App() {
  const { token, user } = useAuthStore();

  return (
    <Routes>
      {/* ── Public routes ────────────────────────────────── */}
      <Route
        path="/"
        element={<Navigate to={token ? (user?.isVerified ? '/dashboard' : '/verify/step1') : '/login'} replace />}
      />
      <Route
        path="/login"
        element={token ? <Navigate to={user?.isVerified ? '/dashboard' : '/verify/step1'} replace /> : <Login />}
      />
      <Route
        path="/signup"
        element={token ? <Navigate to="/dashboard" replace /> : <Signup />}
      />
      <Route path="/otp" element={<Otp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />

      {/* ── Verification routes (logged in, not yet verified) ── */}
      <Route element={<UnverifiedRoute />}>
        <Route path="/verify/step1" element={<Step1 />} />
        <Route path="/verify/step2" element={<Step2 />} />
        <Route path="/verify/step3" element={<Step3 />} />
        <Route path="/verify/waiting" element={<Waiting />} />
      </Route>

      {/* ── Protected + Verified routes ──────────────────── */}
      <Route element={<VerifiedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/request/new" element={<NewRequest />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* ── Fallback ─────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
