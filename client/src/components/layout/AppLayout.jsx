import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MdDashboard, MdArticle, MdAddCircle, MdPerson, MdLogout } from 'react-icons/md';
import useAuthStore from '../../store/authStore';
import Logo from '../common/Logo';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard', icon: MdDashboard, label: 'Dashboard' },
  { to: '/requests', icon: MdArticle, label: 'My Requests' },
  { to: '/request/new', icon: MdAddCircle, label: 'New Request' },
  { to: '/profile', icon: MdPerson, label: 'Profile' },
];

function NavItem({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-full pl-1.5 pr-4 py-1.5 font-medium transition-all duration-150
        ${active ? 'bg-white text-forest shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors
          ${active ? 'bg-forest text-white' : 'bg-white/10 text-white/80 group-hover:bg-white/15'}`}
      >
        <Icon size={18} />
      </span>
      <span className="text-sm">{label}</span>
    </Link>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <Logo size={38} />
      <span className="font-extrabold text-xl text-white">iRequestD</span>
    </div>
  );
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleLogout() {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  }

  const UserCard = (
    <div className="flex items-center gap-3 px-2">
      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <span className="text-white font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-white truncate">{user?.username}</p>
        <p className="text-xs text-white/50 truncate">{user?.contactNumber}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-forest-deep lg:p-5">
      <div className="min-h-screen lg:min-h-[calc(100vh-2.5rem)] flex flex-col md:flex-row bg-mint lg:rounded-[28px] lg:overflow-hidden lg:shadow-frame">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 sticky top-0 h-screen lg:h-auto lg:min-h-full bg-gradient-to-b from-forest-700 via-forest to-forest-deep px-4 py-6 overflow-y-auto">
          <div className="mb-8">
            <Brand />
          </div>
          <p className="px-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Navigation
          </p>
          <nav className="flex flex-col gap-1.5 flex-1">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} active={pathname === item.to} />
            ))}
          </nav>
          <div className="border-t border-white/10 pt-4 mt-4">
            <p className="px-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              User Account
            </p>
            {UserCard}
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors font-medium text-sm"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10">
                <MdLogout size={18} />
              </span>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 pb-24 md:pb-0 min-w-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-forest text-white flex z-40 safe-bottom shadow-[0_-8px_24px_rgba(8,42,32,0.25)]">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-[11px] font-medium transition-colors
                  ${active ? 'text-white' : 'text-white/55'}`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
                    ${active ? 'bg-white/15' : ''}`}
                >
                  <Icon size={20} />
                </span>
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 text-[11px] font-medium text-white/55 hover:text-white transition-colors"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full">
              <MdLogout size={20} />
            </span>
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
}
