import { NavLink } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const navLinks = {
  Secretary: [
    { to: '/secretary', label: 'Dashboard' },
  ],
  Collector: [
    { to: '/collector', label: 'Dashboard' },
  ],
  'Barangay Captain': [
    { to: '/captain', label: 'Dashboard' },
  ],
};

export default function Sidebar() {
  const { user } = useAuthStore();
  const links = navLinks[user?.role] || [];

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-green-rich/80 border-r border-white/10 pt-6 px-4 gap-1">
      <p className="text-gold/70 text-xs uppercase tracking-widest mb-4">Menu</p>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gold text-green-rich'
                : 'text-white/80 hover:bg-white/10'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </aside>
  );
}
