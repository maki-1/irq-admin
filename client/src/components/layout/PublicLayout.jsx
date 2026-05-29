import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function PublicLayout({ children }) {
  const { token } = useAuthStore();
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-extrabold">i</span>
          </div>
          <span className="font-extrabold text-lg text-primary">iRequestD</span>
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
