import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSearch, FiUsers, FiCheckCircle, FiClock, FiX,
  FiUser, FiMapPin, FiPhone, FiMail, FiCalendar, FiHome, FiDownload, FiAward,
} from 'react-icons/fi';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { exportReportPDF, exportReportXLSX } from '../../utils/reportExport';

/* The roster is read-only on purpose. A Purok Leader attests who lives in their
 * purok; approving or rejecting a verification stays with the Secretary, so
 * nothing on this page writes. */

const STATUS_CFG = {
  draft:           { bg: '#F5F5F5', color: '#827575', label: 'Draft'        },
  pending:         { bg: '#FFF7ED', color: '#C2610A', label: 'Pending'      },
  submitted:       { bg: '#EFF6FF', color: '#1D6DB5', label: 'Submitted'    },
  'under review':  { bg: '#EFF6FF', color: '#1D6DB5', label: 'Under Review' },
  approved:        { bg: '#F0FDF4', color: '#156D07', label: 'Approved'     },
  rejected:        { bg: '#FFF1F2', color: '#BE123C', label: 'Rejected'     },
};

const norm = (s) => (s || '').toLowerCase();

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[norm(status)] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {cfg.label}
    </span>
  );
}

/* PWD / Senior / Indigent drive the clearance-fee exemptions, so they belong on
 * the roster rather than buried in a detail view. */
function Tags({ r }) {
  const tags = [
    r.isPwd && { label: 'PWD', color: '#7C3AED' },
    r.isSenior && { label: 'Senior', color: '#2563EB' },
    r.isIndigent && { label: 'Indigent', color: '#B45309' },
  ].filter(Boolean);
  if (!tags.length) return <span style={{ color: '#D6CFCF' }}>—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t.label} className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: `${t.color}15`, color: t.color }}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#FFFFFF' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>{label}</p>
        <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#1E1E1E', fontSize: 24, fontWeight: 700 }}>{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
        <Icon size={13} color="#156D07" />
      </div>
      <div>
        <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 11 }}>{label}</p>
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13 }}>{value}</p>
      </div>
    </div>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function DetailModal({ resident, onClose }) {
  // Escape closes it, like every other dismissable overlay in the portal.
  // Declared before the early return so the hook order stays stable.
  useEffect(() => {
    if (!resident) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resident, onClose]);

  if (!resident) return null;
  const r = resident;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90dvh]" style={{ background: '#FFFFFF' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <div className="flex items-center gap-3">
            {r.avatar
              ? <img src={r.avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
              : <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                  <FiUser size={20} color="#156D07" />
                </div>}
            <div>
              <h2 style={{ fontFamily: "'Kaisei Decol', serif", color: '#0B3D2E', fontSize: 18 }}>{r.fullName || r.username || '—'}</h2>
              <StatusBadge status={r.status} />
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#F7F3F3' }}>
            <FiX size={16} color="#827575" />
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={FiMapPin}   label="Address"          value={r.address} />
          <InfoRow icon={FiHome}     label="Purok"            value={r.purok} />
          <InfoRow icon={FiPhone}    label="Contact Number"   value={r.contactNumber} />
          <InfoRow icon={FiMail}     label="Email"            value={r.email} />
          <InfoRow icon={FiUser}     label="Age / Gender"     value={[r.age, r.gender].filter(Boolean).join(' · ')} />
          <InfoRow icon={FiCalendar} label="Birthday"         value={fmtDate(r.birthday)} />
          <InfoRow icon={FiHome}     label="Years of Residence" value={r.yearsAtAddress} />
          <InfoRow icon={FiUser}     label="Account"          value={r.username} />
          <InfoRow icon={FiCalendar} label="Registered"       value={fmtDate(r.createdAt)} />
          <InfoRow icon={FiCheckCircle} label="Reviewed"      value={fmtDate(r.reviewedAt)} />
        </div>

        <div className="px-6 pb-5">
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 11, marginBottom: 6 }}>Classification</p>
          <Tags r={r} />
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function PurokLeaderResidence() {
  const { user } = useAuthStore();
  const [residents, setResidents] = useState([]);
  const [purok,     setPurok]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('all');
  const [selected,  setSelected]  = useState(null);
  const [page,      setPage]      = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/purok-leader/residents');
        if (cancelled) return;
        setResidents(Array.isArray(data.residents) ? data.residents : []);
        setPurok(data.purok || user?.purok || '');
        setError('');
      } catch (err) {
        if (cancelled) return;
        const msg = err.response?.data?.message || 'Failed to load residents';
        setError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.purok]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents.filter((r) => {
      if (status !== 'all' && norm(r.status) !== status) return false;
      if (!q) return true;
      return [r.fullName, r.username, r.address, r.contactNumber, r.email]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [residents, search, status]);

  useEffect(() => { setPage(1); }, [search, status]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);

  const stats = useMemo(() => ({
    total:    residents.length,
    approved: residents.filter((r) => norm(r.status) === 'approved').length,
    waiting:  residents.filter((r) => ['pending', 'submitted', 'under review'].includes(norm(r.status))).length,
    flagged:  residents.filter((r) => r.isPwd || r.isSenior || r.isIndigent).length,
  }), [residents]);

  const COLUMNS = ['#', 'Full Name', 'Address', 'Contact', 'Age', 'Gender', 'Years of Residence', 'Classification', 'Status'];
  const buildRows = () => rows.map((r, i) => [
    i + 1,
    r.fullName || r.username || '—',
    r.address || '—',
    r.contactNumber || '—',
    r.age ?? '—',
    r.gender || '—',
    r.yearsAtAddress ?? '—',
    [r.isPwd && 'PWD', r.isSenior && 'Senior', r.isIndigent && 'Indigent'].filter(Boolean).join(', ') || '—',
    STATUS_CFG[norm(r.status)]?.label || r.status || '—',
  ]);

  const common = () => ({
    title: 'List of Residents',
    subtitle: `${purok || 'Purok'} · ${rows.length} resident${rows.length === 1 ? '' : 's'}`
      + (status === 'all' ? '' : ` · ${STATUS_CFG[status]?.label || status}`)
      + (search ? ` · search "${search}"` : ''),
    columns: COLUMNS,
    rows: buildRows(),
    user,
    filename: `${(purok || 'purok').replace(/\s+/g, '-').toLowerCase()}-residents`,
  });

  async function exportExcel() {
    try { await exportReportXLSX({ ...common(), sheetName: 'Residents' }); }
    catch { toast.error('Excel export failed'); }
  }
  async function exportPDF() {
    try { await exportReportPDF({ ...common(), orientation: 'landscape' }); }
    catch { toast.error('PDF export failed'); }
  }

  return (
    <PurokLeaderLayout title="List of Residents">
      {error ? (
        <div className="rounded-2xl px-5 py-4 mb-5" style={{ background: '#FFF1F2', color: '#BE123C', fontFamily: "'Hanken Grotesk', sans-serif" }}>
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FiUsers}       label={`Residents in ${purok || 'your purok'}`} value={stats.total}    color="#156D07" />
        <StatCard icon={FiCheckCircle} label="Verified"                                 value={stats.approved} color="#2563EB" />
        <StatCard icon={FiClock}       label="Awaiting Review"                          value={stats.waiting}  color="#B45309" />
        <StatCard icon={FiAward}       label="PWD / Senior / Indigent"                  value={stats.flagged}  color="#7C3AED" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch size={15} color="#A18D8D" className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, address or contact…"
            className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none"
            style={{ background: '#FFFFFF', border: '1px solid #F0EAEA', fontFamily: "'Hanken Grotesk', sans-serif" }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: '#FFFFFF', border: '1px solid #F0EAEA', fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={exportExcel} disabled={!rows.length}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: '#F0FDF4', color: '#156D07' }}>
            <FiDownload size={14} /> Export Excel
          </button>
          <button onClick={exportPDF} disabled={!rows.length}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#156D07' }}>
            <FiDownload size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
        {/* Phones get stacked cards. A purok leader checking a resident on a
            handset should not have to scroll an eight-column table sideways. */}
        <div className="sm:hidden">
          {loading ? (
            <p className="text-center py-10 text-sm" style={{ color: '#A18D8D' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-center py-10 px-4 text-sm" style={{ color: '#A18D8D' }}>
              {residents.length === 0
                ? `No residents are registered under ${purok || 'your purok'} yet.`
                : 'No residents match this filter.'}
            </p>
          ) : (
            paged.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left px-4 py-3.5 active:bg-[#FBFAFA]"
                style={{ borderBottom: '1px solid #F7F3F3', fontFamily: "'Hanken Grotesk', sans-serif" }}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="font-semibold text-sm min-w-0 break-words" style={{ color: '#1E1E1E' }}>
                    <span style={{ color: '#A18D8D', fontWeight: 400 }}>{(safePage - 1) * PAGE_SIZE + i + 1}. </span>
                    {r.fullName || r.username || '—'}
                  </p>
                  <span className="shrink-0"><StatusBadge status={r.status} /></span>
                </div>
                <p className="text-xs mb-1.5 break-words" style={{ color: '#827575' }}>{r.address || '—'}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#555' }}>
                  <span>{r.contactNumber || '—'}</span>
                  {r.age != null && <span>{r.age} yrs old</span>}
                  {r.yearsAtAddress != null && <span>{r.yearsAtAddress} yr residence</span>}
                </div>
                {(r.isPwd || r.isSenior || r.isIndigent) && <div className="mt-2"><Tags r={r} /></div>}
              </button>
            ))
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0EAEA', color: '#827575' }}>
                <th className="text-left px-4 py-3 font-semibold">#</th>
                <th className="text-left px-4 py-3 font-semibold">Full Name</th>
                <th className="text-left px-4 py-3 font-semibold">Address</th>
                <th className="text-left px-4 py-3 font-semibold">Contact</th>
                <th className="text-left px-4 py-3 font-semibold">Age</th>
                <th className="text-left px-4 py-3 font-semibold">Years of Residence</th>
                <th className="text-left px-4 py-3 font-semibold">Classification</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: '#A18D8D' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: '#A18D8D' }}>
                  {residents.length === 0
                    ? `No residents are registered under ${purok || 'your purok'} yet.`
                    : 'No residents match this filter.'}
                </td></tr>
              ) : (
                paged.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer hover:bg-[#FBFAFA]"
                    style={{ borderBottom: '1px solid #F7F3F3' }}
                  >
                    <td className="px-4 py-3" style={{ color: '#A18D8D' }}>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#1E1E1E' }}>{r.fullName || r.username || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#555' }}>{r.address || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#555' }}>{r.contactNumber || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#555' }}>{r.age ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#555' }}>{r.yearsAtAddress ?? '—'}</td>
                    <td className="px-4 py-3"><Tags r={r} /></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ borderTop: '1px solid #F0EAEA' }}>
            <p className="text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}
            </p>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                style={{ background: '#FFFFFF', border: '1px solid #E8E0E0', color: '#555', fontFamily: "'Hahmlet', sans-serif" }}>
                ‹ Prev
              </button>
              {pageNumbers.map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-2 py-1.5 text-xs" style={{ color: '#A18D8D' }}>…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: p === safePage ? '#156D07' : '#FFFFFF',
                      color:      p === safePage ? '#FFFFFF' : '#555',
                      border:     '1px solid #E8E0E0',
                      fontFamily: "'Hahmlet', sans-serif",
                    }}>
                    {p}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                style={{ background: '#FFFFFF', border: '1px solid #E8E0E0', color: '#555', fontFamily: "'Hahmlet', sans-serif" }}>
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      <DetailModal resident={selected} onClose={() => setSelected(null)} />
    </PurokLeaderLayout>
  );
}
