import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FiBell, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { getNotifications, markAllRead } from '../../services/notification.service';
import assets from '../../assets/cloudinaryAssets';

const ROLE_BADGE = {
  Secretary: 'bg-blue-500/20 text-blue-300',
  Collector: 'bg-purple-500/20 text-purple-300',
  'Barangay Captain': 'bg-gold/20 text-gold',
};

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (user) {
      getNotifications().then((r) => setNotifications(r.data)).catch(() => {});
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => n.status === 'Unread').length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'Read' })));
  };

  return (
    <nav className="bg-green-rich/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src={assets.DOLOGONLOGO} alt="Dologon Logo" className="h-10 w-10 rounded-full object-cover" />
          <div>
            <span className="font-garamond text-lg font-semibold text-gold block leading-tight">
              iRequestDologon
            </span>
            <span className="text-white/40 text-xs">Barangay Dologon Portal</span>
          </div>
        </div>

        {/* Desktop right */}
        {user && (
          <div className="hidden md:flex items-center gap-4">
            {/* Role badge */}
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${ROLE_BADGE[user.role] || ''}`}>
              {user.role}
            </span>
            <span className="text-white/70 text-sm">{user.fullName}</span>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative text-white hover:text-gold transition-colors"
              >
                <FiBell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-green-rich border border-white/20 rounded-xl shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                    <span className="text-gold font-semibold text-sm">Notifications</span>
                    <button onClick={handleMarkAllRead} className="text-white/50 text-xs hover:text-white">
                      Mark all read
                    </button>
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-white/10">
                    {notifications.length === 0 && (
                      <li className="px-4 py-3 text-white/50 text-sm">No notifications</li>
                    )}
                    {notifications.map((n) => (
                      <li
                        key={n._id}
                        className={`px-4 py-3 text-sm ${n.status === 'Unread' ? 'bg-white/10' : ''}`}
                      >
                        {n.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white hover:text-gold transition-colors"
            >
              <FiLogOut size={18} />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        )}

        {/* Mobile hamburger */}
        <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && user && (
        <div className="md:hidden bg-green-rich border-t border-white/10 px-4 py-4 flex flex-col gap-3">
          <span className="text-white/70 text-sm">
            {user.fullName} —{' '}
            <span className={`text-xs font-semibold ${ROLE_BADGE[user.role]}`}>{user.role}</span>
          </span>
          <button onClick={handleLogout} className="btn-secondary w-full">Logout</button>
        </div>
      )}
    </nav>
  );
}
