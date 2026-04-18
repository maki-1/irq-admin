import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiHome, FiFileText, FiMenu, FiX,
  FiSearch, FiMessageCircle, FiBell,
  FiUser, FiLogOut, FiChevronDown,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import assets from '../../assets/cloudinaryAssets';

const NAV = [
  { to: '/secretary',           label: 'DASHBOARD', Icon: FiGrid     },
  { to: '/secretary/residents', label: 'RESIDENCE', Icon: FiHome     },
  { to: '/secretary/requests',  label: 'REQUESTS',  Icon: FiFileText },
];

function SidebarContent({ onNavClick }) {
  return (
    <>
      <div className="flex flex-col items-center mb-6 pt-6 px-4">
        <img
          src={assets.DOLOGONLOGO}
          alt="Dologon"
          className="rounded-full object-cover mb-2"
          style={{ width: 80, height: 80 }}
        />
        <span style={{
          fontFamily: "'Kaisei Decol', serif",
          color: '#156D07', fontSize: 18, fontWeight: 700, letterSpacing: 2,
        }}>
          DOLOGON
        </span>
      </div>

      <nav className="w-full flex flex-col gap-1 px-3 mt-6">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/secretary'}
            onClick={onNavClick}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? '' : 'hover:bg-gray-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full"
                    style={{ background: '#156D07' }}
                  />
                )}
                <Icon size={20} style={{ color: isActive ? '#156D07' : '#827575', flexShrink: 0 }} />
                <span style={{
                  fontFamily: "'Kaisei Decol', serif",
                  fontSize: 15, fontWeight: 400,
                  color: isActive ? '#156D07' : '#827575',
                }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/**
 * Shared top bar used on every secretary page.
 * `title` — page heading shown on the left
 */
function TopBar({ title, onHamburger }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [avatarOpen, setAvatarOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm"
          onClick={onHamburger}
        >
          <FiMenu size={20} color="#156D07" />
        </button>
        <h1 style={{
          fontFamily: "'Kaisei Decol', serif",
          color: '#156D07',
          fontSize: 'clamp(18px, 2.5vw, 26px)',
          fontWeight: 400,
        }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow transition-shadow">
          <FiSearch size={17} color="#1E1E1E" />
        </button>
        <button className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow transition-shadow">
          <FiMessageCircle size={17} color="#1E1E1E" />
        </button>
        <button className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow transition-shadow">
          <FiBell size={17} color="#1E1E1E" />
        </button>

        {/* Avatar dropdown */}
        <div className="relative">
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className="flex items-center gap-1 focus:outline-none"
          >
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 shadow-sm"
              style={{ borderColor: '#156D07' }}
            >
              <img src={assets.DOLOGONLOGO} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <FiChevronDown
              size={14} color="#156D07"
              className={`transition-transform duration-200 ${avatarOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {avatarOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
              <div
                className="absolute right-0 mt-2 z-40 rounded-2xl overflow-hidden"
                style={{ width: 200, background: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
              >
                {/* User info */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #F0EAEA' }}>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: '#156D07' }}>
                    <img src={assets.DOLOGONLOGO} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold"
                      style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13 }}>
                      {user?.fullName}
                    </p>
                    <p className="truncate"
                      style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                      {user?.role}
                    </p>
                  </div>
                </div>

                <ul className="py-1">
                  <li>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => { setAvatarOpen(false); navigate('/secretary/profile'); }}
                    >
                      <FiUser size={15} color="#827575" />
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 13 }}>
                        My Profile
                      </span>
                    </button>
                  </li>
                  <li style={{ borderTop: '1px solid #F5F0F0' }}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-colors"
                      onClick={() => { setAvatarOpen(false); logout(); navigate('/login'); }}
                    >
                      <FiLogOut size={15} color="#e53e3e" />
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#e53e3e', fontSize: 13 }}>
                        Logout
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main layout wrapper for all secretary pages.
 *
 * Usage:
 *   <SecretaryLayout title="DASHBOARD">
 *     {page content}
 *   </SecretaryLayout>
 */
export default function SecretaryLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: '#D9D9D9' }}>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col shrink-0"
        style={{ width: 220, background: '#FFFFFF', boxShadow: '2px 0 6px rgba(0,0,0,0.07)', minHeight: '100vh' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={`fixed top-0 left-0 z-50 h-full flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 240, background: '#FFFFFF', boxShadow: '4px 0 16px rgba(0,0,0,0.15)' }}
      >
        <button
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
          onClick={() => setSidebarOpen(false)}
        >
          <FiX size={22} color="#827575" />
        </button>
        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 p-4 sm:p-5 overflow-auto">
        <TopBar title={title} onHamburger={() => setSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}
