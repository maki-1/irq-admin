import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import Logo from '../common/Logo';

export default function PublicLayout({ children }) {
  const { token } = useAuthStore();
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={34} rounded="rounded-xl" />
          <span className="font-extrabold text-lg text-forest">iRequestD</span>
        </Link>
        {!token && (
          <div className="flex gap-3">
            <Link to="/login" className="btn-outline py-2 px-4 text-sm">Login</Link>
            <Link to="/signup" className="btn-primary py-2 px-4 text-sm">Sign Up</Link>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
