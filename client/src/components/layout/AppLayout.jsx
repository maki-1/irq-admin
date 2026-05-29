import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MdDashboard, MdArticle, MdAddCircle, MdPerson, MdLogout } from 'react-icons/md';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard', icon: MdDashboard, label: 'Dashboard' },
  { to: '/requests', icon: MdArticle, label: 'My Requests' },
  { to: '/request/new', icon: MdAddCircle, label: 'New Request' },
  { to: '/profile', icon: MdPerson, label: 'Profile' },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 font-medium
        ${active ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 px-4 py-6 shrink-0 min-h-screen">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-extrabold text-lg">i</span>
          </div>
          <span className="font-extrabold text-xl text-primary">iRequestD</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="text-primary font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-800 truncate">{user?.username}</p>
              <p className="text-xs text-gray-500 truncate">{user?.contactNumber}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium"
          >
            <MdLogout size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 min-w-0">
        <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40 safe-bottom">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = window.location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors
                ${active ? 'text-primary' : 'text-gray-500'}`}
            >
              <Icon size={22} className={active ? 'text-primary' : 'text-gray-400'} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium text-gray-500"
        >
          <MdLogout size={22} className="text-gray-400" />
          Logout
        </button>
      </nav>
    </div>
  );
}
