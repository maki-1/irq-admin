import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiBell, FiX } from 'react-icons/fi';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { getNotifications, markAllRead } from '../../services/notification.service';

/* One header cluster shared by the Captain / Secretary / Collector layouts:
   quick search, notifications (live), and a running clock. */

const GREEN = '#156D07';

function relTime(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// Role → where the search looks and where a result jumps to.
function searchConfigFor(role) {
  if (role === 'Collector') {
    return {
      kind: 'requests',
      base: '/collector/payments',
      fetch: () => api.get('/requests').then((r) => r.data.data || r.data || []),
    };
  }
  const base = role === 'Barangay Captain' ? '/captain' : '/secretary';
  return {
    kind: 'residents',
    base: `${base}/residents`,
    fetch: () => api.get('/verifications').then((r) => r.data || []),
  };
}

export default function HeaderActions() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const cfg = useMemo(() => searchConfigFor(user?.role), [user?.role]);

  /* ── clock ── */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── notifications ── */
  const [notes, setNotes] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const loadNotes = () => getNotifications().then((r) => setNotes(r.data || [])).catch(() => {});
  useEffect(() => {
    loadNotes();
    const t = setInterval(loadNotes, 30000); // keep the badge fresh
    return () => clearInterval(t);
  }, []);
  const unread = notes.filter((n) => n.status === 'Unread').length;
  const handleMarkAll = () => {
    markAllRead().catch(() => {});
    setNotes((prev) => prev.map((n) => ({ ...n, status: 'Read' })));
  };

  /* ── search ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [pool, setPool] = useState(null); // fetched once when the popover opens
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen && pool === null) {
      setLoading(true);
      cfg.fetch()
        .then((data) => setPool(Array.isArray(data) ? data : []))
        .catch(() => setPool([]))
        .finally(() => setLoading(false));
    }
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    if (!pool || !term.trim()) return [];
    const q = term.trim().toLowerCase();
    if (cfg.kind === 'residents') {
      return pool
        .filter((p) => `${p.fullName || ''} ${p.address || ''}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map((p) => ({ id: p._id || p.id, title: p.fullName || '—', sub: p.address || p.purok || '' }));
    }
    return pool
      .filter((r) => {
        const name = r.profile?.fullName || r.user?.username || '';
        return `${name} ${r.documentType || ''} ${r.orNumber || ''}`.toLowerCase().includes(q);
      })
      .slice(0, 6)
      .map((r) => ({
        id: r._id || r.id,
        title: r.profile?.fullName || r.user?.username || '—',
        sub: `${r.documentType || ''}${r.orNumber ? ` · ${r.orNumber}` : ''}`,
      }));
  }, [pool, term, cfg.kind]);

  const goTo = (title) => {
    setSearchOpen(false);
    setTerm('');
    navigate(`${cfg.base}?q=${encodeURIComponent(title)}`);
  };
  const submitSearch = (e) => {
    e.preventDefault();
    if (results[0]) goTo(results[0].title);
    else if (term.trim()) { setSearchOpen(false); navigate(`${cfg.base}?q=${encodeURIComponent(term.trim())}`); }
  };

  const iconBtn = 'w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow transition-shadow';

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative">
        <button className={iconBtn} onClick={() => setSearchOpen((v) => !v)} title="Search">
          <FiSearch size={17} color="#1E1E1E" />
        </button>
        {searchOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setSearchOpen(false)} />
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white z-40 overflow-hidden"
              style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.18)', border: '1px solid #F0EAEA' }}>
              <form onSubmit={submitSearch} className="p-2" style={{ borderBottom: '1px solid #F5F0F0' }}>
                <input
                  ref={inputRef}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={cfg.kind === 'residents' ? 'Search residents…' : 'Search requests…'}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: '#F7F5F5', fontFamily: "'Hanken Grotesk', sans-serif" }}
                />
              </form>
              <div className="max-h-72 overflow-y-auto">
                {loading && <p className="px-4 py-4 text-xs" style={{ color: '#A18D8D' }}>Loading…</p>}
                {!loading && term.trim() && results.length === 0 && (
                  <p className="px-4 py-4 text-xs" style={{ color: '#A18D8D' }}>No matches.</p>
                )}
                {!loading && !term.trim() && (
                  <p className="px-4 py-4 text-xs" style={{ color: '#C0B0B0' }}>
                    Type a {cfg.kind === 'residents' ? 'resident name or address' : 'name, document, or OR number'}.
                  </p>
                )}
                {results.map((r) => (
                  <button key={r.id} onClick={() => goTo(r.title)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: '1px solid #FAF7F7' }}>
                    <p className="text-sm font-semibold" style={{ color: '#333', fontFamily: "'Hanken Grotesk', sans-serif" }}>{r.title}</p>
                    {r.sub && <p className="text-xs truncate" style={{ color: '#A18D8D' }}>{r.sub}</p>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      <div className="relative">
        <button className={iconBtn} onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) loadNotes(); }} title="Notifications">
          <FiBell size={17} color="#1E1E1E" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-white"
              style={{ background: '#DC2626', fontSize: 10, fontWeight: 700 }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white z-40 overflow-hidden"
              style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.18)', border: '1px solid #F0EAEA' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F5F0F0' }}>
                <p className="text-sm font-bold" style={{ color: GREEN, fontFamily: "'Kaisei Decol', serif" }}>Notifications</p>
                {unread > 0 && (
                  <button onClick={handleMarkAll} className="text-xs font-semibold hover:underline" style={{ color: GREEN }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notes.length === 0 && (
                  <p className="px-4 py-8 text-center text-xs" style={{ color: '#C0B0B0' }}>No notifications yet.</p>
                )}
                {notes.map((n) => (
                  <div key={n._id || n.id} className="px-4 py-3 flex gap-3"
                    style={{ borderBottom: '1px solid #FAF7F7', background: n.status === 'Unread' ? '#F0FDF4' : '#fff' }}>
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: n.status === 'Unread' ? GREEN : '#E0DADA' }} />
                    <div className="min-w-0">
                      <p className="text-xs" style={{ color: '#374151', fontFamily: "'Hanken Grotesk', sans-serif", lineHeight: 1.5 }}>{n.message}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#A18D8D' }}>{relTime(n.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Live clock */}
      <div className="hidden sm:flex flex-col items-end leading-none px-2" title={now.toLocaleDateString('en-PH', { weekday: 'long' })}>
        <span style={{ fontFamily: "'Kaisei Decol', serif", color: GREEN, fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
          {now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </span>
        <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 10 }}>
          {now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
