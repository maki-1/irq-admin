import { useNavigate } from 'react-router-dom';
import { MdLogout } from 'react-icons/md';
import useAuthStore from '../../store/authStore';

export default function VerifyLayout({ children }) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-extrabold">i</span>
          </div>
          <span className="font-extrabold text-lg text-primary">iRequestD</span>
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
