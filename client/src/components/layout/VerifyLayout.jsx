import { useNavigate } from 'react-router-dom';
import { MdLogout } from 'react-icons/md';
import useAuthStore from '../../store/authStore';
import Logo from '../common/Logo';

export default function VerifyLayout({ children }) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-mint">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur border-b border-black/5">
        <div className="flex items-center gap-2">
          <Logo size={34} rounded="rounded-xl" />
          <span className="font-extrabold text-lg text-forest">iRequestD</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          <MdLogout size={18} />
          Logout
        </button>
      </header>
      {children}
    </div>
  );
}
