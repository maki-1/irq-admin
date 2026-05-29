import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

function getVerifyRedirect(user) {
  if (!user) return '/login';
  if (user.verificationStatus === 'pending') return '/verify/waiting';
  const step = user.verificationStep ?? 0;
  if (step === 0) return '/verify/step1';
  if (step === 1) return '/verify/step2';
  if (step === 2) return '/verify/step3';
  return '/verify/waiting';
}

export default function VerifiedRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user?.isVerified) return <Navigate to={getVerifyRedirect(user)} replace />;
  return <Outlet />;
}
