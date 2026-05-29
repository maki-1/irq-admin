import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function UnverifiedRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.isVerified) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
