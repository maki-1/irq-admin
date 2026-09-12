import { useEffect, useMemo, useState } from 'react';
import { FiDownload, FiCheckCircle, FiClock, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { exportReportPDF, exportReportXLSX } from '../../utils/reportExport';

const peso = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PAGE_SIZE = 10;

// The fee a Purok Leader sets is stamped onto each request when they approve it
// (request.purokClearanceFee). This module records those assessments per purok,
// separates what has actually been collected (the resident has paid) from what
// is still outstanding, and exports the list.
const feeOf = (r) => Number(r.purokClearanceFee || 0);
// Approval is when the fee is assigned; fall back to createdAt for old rows.
const dateOf = (r) => new Date(r.purokLeaderAt || r.createdAt);

// react-icons has no peso glyph, so this stands in wherever FiDollarSign
// would otherwise be used for a peso-denominated stat.
function PesoIcon({ size = 24, style }) {
  return (
    <span style={{ ...style, fontSize: size * 0.75, fontWeight: 700, lineHeight: 1 }}>
      ₱
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 min-w-0" style={{ background: '#FFFFFF' }}>
      <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>{label}</p>
        <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#1E1E1E', fontSize: 24, fontWeight: 700 }}>{value}</p>
      </div>
    </div>
  );
}

const PAY_STYLE = {
  paid:   { bg: '#F0FDF4', color: '#156D07', label: 'Collected' },
  unpaid: { bg: '#FFF7ED', color: '#B45309', label: 'Unpaid' },
  free:   { bg: '#EFF6FF', color: '#2563EB', label: 'Free' },
};

function PayBadge({ status }) {
  const s = PAY_STYLE[String(status || '').toLowerCase()] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {s.label}
    </span>
  );
}

export default function PurokLeaderFeeReport() {
  const { user }            = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [page, setPage]         = useState(1);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/purok-leader/requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load fee report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Only approved requests carry a clearance fee.
  const rows = useMemo(() => {
    const start = from ? new Date(from) : null;
    const end   = to ? new Date(`${to}T23:59:59`) : null;
    return requests
      .filter((r) => String(r.purokLeaderStatus).toLowerCase() === 'approved' && feeOf(r) > 0)
      .filter((r) => {
        const d = dateOf(r);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      })
      .sort((a, b) => dateOf(b) - dateOf(a));
  }, [requests, from, to]);

  const totals = useMemo(() => {
    const assessed  = rows.reduce((s, r) => s + feeOf(r), 0);
    const collected = rows.filter((r) => r.paymentStatus === 'paid').reduce((s, r) => s + feeOf(r), 0);
    return { assessed, collected, pending: assessed - collected, count: rows.length };
  }, [rows]);

  useEffect(() => { setPage(1); }, [from, to]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const nameOf = (r) => r.profile?.fullName || r.user?.username || '—';
  const purok  = user?.purok || 'Purok';

  const COLUMNS = ['#', 'Date Approved', 'Resident', 'Document', 'OR No.', 'Clearance Fee', 'Payment'];
  const buildRows = () => rows.map((r, i) => [
    i + 1,
    dateOf(r).toLocaleDateString('en-PH'),
    nameOf(r),
    r.documentType || '—',
    r.orNumber || '—',
    peso(feeOf(r)),
    r.paymentStatus === 'paid' ? 'Collected' : (r.paymentStatus || 'unpaid'),
  ]);
  const FOOT = ['', '', '', '', 'TOTAL', peso(totals.assessed), `Collected ${peso(totals.collected)}`];
  const subtitle = `${purok} · ${from || to ? `${from || '…'} to ${to || '…'}` : 'All records'}`
    + ` · Assessed ${peso(totals.assessed)} · Collected ${peso(totals.collected)} · Outstanding ${peso(totals.pending)}`;
  const baseName = `${purok.replace(/\s+/g, '-').toLowerCase()}-clearance-fees`;
  const common = () => ({
    title: 'Purok Clearance Fee Report',
    subtitle,
    columns: COLUMNS,
    rows: buildRows(),
    foot: FOOT,
    user,
    filename: baseName,
  });

  async function exportExcel() {
    try { await exportReportXLSX({ ...common(), sheetName: 'Clearance Fees' }); }
    catch { toast.error('Excel export failed'); }
  }
  async function exportPDF() {
    try { await exportReportPDF({ ...common(), orientation: 'landscape' }); }
    catch { toast.error('PDF export failed'); }
  }

  return (
    <PurokLeaderLayout title="Fee Report">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm" style={{ background: '#FFFFFF', border: '1px solid #F0EAEA' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm" style={{ background: '#FFFFFF', border: '1px solid #F0EAEA' }} />
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); }}
            className="rounded-xl px-3 py-2 text-sm" style={{ color: '#827575' }}>Clear</button>
        )}
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard icon={PesoIcon}      label="Total Fees Assessed" value={peso(totals.assessed)}  color="#156D07" />
        <StatCard icon={FiCheckCircle} label="Collected"           value={peso(totals.collected)} color="#2563EB" />
        <StatCard icon={FiClock}       label="Outstanding"         value={peso(totals.pending)}   color="#B45309" />
        <StatCard icon={FiFileText}    label="Approvals"           value={totals.count}           color="#7C3AED" />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
        {/* Phones get stacked cards instead of a seven-column table. */}
        <div className="sm:hidden">
          {loading ? (
            <p className="text-center py-10 text-sm" style={{ color: '#A18D8D' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-center py-10 px-4 text-sm" style={{ color: '#A18D8D' }}>
              No clearance fees recorded for this range.
            </p>
          ) : (
            <>
              {rows.map((r, i) => (
                <div key={r.id || r._id} className="px-4 py-3.5"
                  style={{ borderBottom: '1px solid #F7F3F3', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-sm font-semibold min-w-0 break-words" style={{ color: '#1E1E1E' }}>
                      <span style={{ color: '#A18D8D', fontWeight: 400 }}>{i + 1}. </span>{nameOf(r)}
                    </p>
                    <span className="text-sm font-bold shrink-0" style={{ color: '#156D07' }}>{peso(feeOf(r))}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: '#555' }}>
                    <span>{dateOf(r).toLocaleDateString('en-PH')}</span>
                    <span className="break-words">{r.documentType || '—'}</span>
                    {r.orNumber && <span>OR {r.orNumber}</span>}
                    <PayBadge status={r.paymentStatus} />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: '2px solid #F0EAEA', background: '#FBFAFA', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                <span className="text-sm font-bold" style={{ color: '#1E1E1E' }}>TOTAL</span>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: '#156D07' }}>{peso(totals.assessed)}</p>
                  <p className="text-xs" style={{ color: '#827575' }}>Collected {peso(totals.collected)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0EAEA', color: '#827575' }}>
                <th className="text-left px-4 py-3 font-semibold">#</th>
                <th className="text-left px-4 py-3 font-semibold">Date Approved</th>
                <th className="text-left px-4 py-3 font-semibold">Resident</th>
                <th className="text-left px-4 py-3 font-semibold">Document</th>
                <th className="text-left px-4 py-3 font-semibold">OR No.</th>
                <th className="text-right px-4 py-3 font-semibold">Clearance Fee</th>
                <th className="text-left px-4 py-3 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: '#A18D8D' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: '#A18D8D' }}>No clearance fees recorded for this range.</td></tr>
              ) : (
                paged.map((r, i) => (
                  <tr key={r.id || r._id} style={{ borderBottom: '1px solid #F7F3F3' }}>
                    <td className="px-4 py-3" style={{ color: '#A18D8D' }}>{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3" style={{ color: '#1E1E1E' }}>{dateOf(r).toLocaleDateString('en-PH')}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#1E1E1E' }}>{nameOf(r)}</td>
                    <td className="px-4 py-3" style={{ color: '#555' }}>{r.documentType || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#555' }}>{r.orNumber || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#156D07' }}>{peso(feeOf(r))}</td>
                    <td className="px-4 py-3"><PayBadge status={r.paymentStatus} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid #F0EAEA', background: '#FBFAFA' }}>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold" style={{ color: '#1E1E1E' }}>TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: '#156D07' }}>{peso(totals.assessed)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#827575' }}>Collected {peso(totals.collected)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ borderTop: '1px solid #F0EAEA' }}>
            <p className="text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                  Page {safePage} of {totalPages}
                </span>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E0E0', color: '#555', fontFamily: "'Hahmlet', sans-serif" }}>
                  ‹ Prev
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E0E0', color: '#555', fontFamily: "'Hahmlet', sans-serif" }}>
                  Next ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PurokLeaderLayout>
  );
}
