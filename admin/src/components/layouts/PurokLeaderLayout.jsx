import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiClipboard, FiMenu, FiX,
  FiUser, FiLogOut, FiChevronDown, FiDollarSign, FiFilePlus,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import assets from '../../assets/cloudinaryAssets';

const NAV = [
  { to: '/purok-leader',                 label: 'DASHBOARD',       Icon: FiGrid       },
  { to: '/purok-leader/issue-clearance',  label: 'ISSUE CLEARANCE', Icon: FiFilePlus   },
  { to: '/purok-leader/requests',         label: 'REQUESTS',        Icon: FiClipboard  },
  { to: '/purok-leader/fee-report',       label: 'FEE REPORT',      Icon: FiDollarSign },
];

function SidebarContent({ onNavClick }) {
  return (
    <>
      <div className="flex flex-col items-center mb-2 pt-7 px-4">
        <img src={assets.DOLOGONLOGO} alt="Dologon" className="rounded-full object-cover mb-3 ring-2 ring-white/15" style={{ width: 72, height: 72 }} />
        <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#FFFFFF', fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
          DOLOGON
        </span>
        <span className="text-[11px] mt-0.5 text-white/50">
          Purok Leader
        </span>
      </div>

      <p className="px-5 mt-6 mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        Navigation
      </p>
      <nav className="w-full flex flex-col gap-1.5 px-3">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/purok-leader'} onClick={onNavClick}
            className={({ isActive }) => `group flex items-center gap-3 rounded-full pl-1.5 pr-4 py-1.5 transition-all duration-150 ${isActive ? 'bg-white shadow-sm' : 'hover:bg-white/10'}`}
          >
            {({ isActive }) => (
              <>
                <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors ${isActive ? 'bg-forest text-white' : 'bg-white/10 text-white/80 group-hover:bg-white/15'}`}>
                  <Icon size={17} />
                </span>
                <span className={`text-sm font-medium ${isActive ? 'text-forest' : 'text-white/75'}`}>
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

function TopBar({ title, onHamburger }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [avatarOpen, setAvatarOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <button className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm" onClick={onHamburger}>
          <FiMenu size={20} color="#156D07" />
        </button>
        <div>
          <h1 style={{ fontFamily: "'Kaisei Decol', serif", color: '#0B3D2E', fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 400 }}>
            {title}
          </h1>
          {user?.purok && (
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
              {user.purok}
            </p>
          )}
        </div>
      </div>

      <div className="relative">
        <button onClick={() => setAvatarOpen((v) => !v)} className="flex items-center gap-1 focus:outline-none">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 shadow-sm" style={{ borderColor: '#156D07' }}>
            <img src={assets.DOLOGONLOGO} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <FiChevronDown size={14} color="#156D07" className={`transition-transform duration-200 ${avatarOpen ? 'rotate-180' : ''}`} />
        </button>

        {avatarOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
            <div className="absolute right-0 mt-2 z-40 rounded-2xl overflow-hidden"
              style={{ width: 200, background: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #F0EAEA' }}>
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: '#156D07' }}>
                  <img src={assets.DOLOGONLOGO} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13 }}>{user?.fullName}</p>
                  <p className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>{user?.purok}</p>
                </div>
              </div>
              <ul className="py-1">
                <li style={{ borderTop: '1px solid #F5F0F0' }}>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-colors"
                    onClick={() => { setAvatarOpen(false); logout(); navigate('/login'); }}>
                    <FiLogOut size={15} color="#e53e3e" />
                    <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#e53e3e', fontSize: 13 }}>Logout</span>
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PurokLeaderLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen lg:p-4" style={{ background: '#082A20' }}>
     <div className="lg:flex lg:gap-4 lg:items-start">
      <aside className="hidden lg:flex flex-col shrink-0 sticky top-4 h-[calc(100vh-2rem)] rounded-[24px] overflow-y-auto shadow-2xl bg-gradient-to-b from-forest-700 via-forest to-forest-deep"
        style={{ width: 224 }}>
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed top-0 left-0 z-50 h-full flex flex-col lg:hidden transition-transform duration-300 ease-in-out bg-gradient-to-b from-forest-700 via-forest to-forest-deep ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 240, boxShadow: '4px 0 16px rgba(0,0,0,0.25)' }}>
        <button className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10" onClick={() => setSidebarOpen(false)}>
          <FiX size={22} color="#FFFFFF" />
        </button>
        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </div>

      <div
        className="flex flex-col flex-1 min-w-0 min-h-screen lg:min-h-[calc(100vh-2rem)] lg:rounded-[24px] lg:shadow-xl p-4 sm:p-6 overflow-auto"
        style={{ background: '#EDF4EC' }}
      >
        <TopBar title={title} onHamburger={() => setSidebarOpen(true)} />
        {children}
      </div>
     </div>
    </div>
  );
}
