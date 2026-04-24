import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSearch, FiFileText, FiCheckCircle, FiXCircle,
  FiClock, FiLoader, FiPrinter, FiChevronLeft, FiChevronRight, FiDownload,
} from 'react-icons/fi';
import { getRequests, updateRequestStatus } from '../../services/request.service';
import SecretaryLayout from '../../components/layouts/SecretaryLayout';
import PrintDocumentModal from '../../components/common/PrintDocumentModal';

/* ── Status configs ── */
const DOC_STATUS_CFG = {
  pending:    { bg: '#FFF7ED', color: '#C2610A', label: 'Pending',    Icon: FiClock       },
  processing: { bg: '#EFF6FF', color: '#1D6DB5', label: 'Processing', Icon: FiLoader      },
  printing:   { bg: '#F5F3FF', color: '#6D28D9', label: 'Printing',   Icon: FiPrinter     },
  completed:  { bg: '#F0FDF4', color: '#156D07', label: 'Completed',  Icon: FiCheckCircle },
  rejected:   { bg: '#FFF1F2', color: '#BE123C', label: 'Rejected',   Icon: FiXCircle     },
};

const PAY_STATUS_CFG = {
  unpaid: { bg: '#FFF7ED', color: '#C2610A', label: 'Unpaid' },
  paid:   { bg: '#F0FDF4', color: '#156D07', label: 'Paid'   },
};

const norm = (s) => (s || '').toLowerCase();

function DocStatusBadge({ status }) {
  const cfg = DOC_STATUS_CFG[norm(status)] || { bg: '#F5F5F5', color: '#888', label: status || '—', Icon: FiFileText };
  const { Icon } = cfg;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function PayBadge({ status }) {
  const cfg = PAY_STATUS_CFG[norm(status)] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {cfg.label}
    </span>
  );
}

const DOC_STATUSES = ['All', 'Pending', 'Processing', 'Printing', 'Completed', 'Rejected'];
const PAGE_SIZE = 10;

export default function SecretaryRequests() {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo,   setDateTo]     = useState('');
  const [page, setPage]           = useState(1);
  const [updatingId, setUpdating]   = useState(null);
  const [printing,   setPrinting]   = useState(null); // request being printed

  const fetchRequests = () => {
    setLoading(true);
    getRequests()
      .then((r) => setRequests(r.data))
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
    const iv = setInterval(fetchRequests, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo]);

  const filtered = requests.filter((r) => {
    const matchStatus = statusFilter === 'All' || norm(r.status) === norm(statusFilter);
    const q = search.toLowerCase();
    const name = (r.profile?.fullName || r.user?.username || '').toLowerCase();
    const matchSearch =
      !q ||
      name.includes(q) ||
      (r.documentType || '').toLowerCase().includes(q) ||
      (r.purpose || '').toLowerCase().includes(q) ||
      (r._id || '').toLowerCase().includes(q);
    const created = r.createdAt ? new Date(r.createdAt) : null;
    const matchFrom = !dateFrom || (created && created >= new Date(dateFrom));
    const matchTo   = !dateTo   || (created && created <= new Date(dateTo + 'T23:59:59'));
    return matchStatus && matchSearch && matchFrom && matchTo;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aCompleted = norm(a.status) === 'completed' ? 1 : 0;
    const bCompleted = norm(b.status) === 'completed' ? 1 : 0;
    return aCompleted - bCompleted;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      await updateRequestStatus(id, { status });
      toast.success(`Status updated to ${status}`);
      fetchRequests();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const exportCSV = () => {
    const headers = ['#', 'Request ID', 'Name', 'Contact', 'Document Type', 'Purpose', 'Status', 'Payment', 'Date'];
    const rows = sorted.map((r, i) => [
      i + 1,
      String(r._id).slice(-6).toUpperCase(),
      r.profile?.fullName || r.user?.username || '',
      r.user?.contactNumber || r.user?.email || '',
      r.documentType || '',
      r.purpose || '',
      r.status || '',
      r.paymentStatus || '',
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="no-print">
    <SecretaryLayout title="REQUESTS">
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch
              size={15} color="#A18D8D"
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name, document type, purpose…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white outline-none text-sm"
              style={{
                border: '1px solid #E8E0E0',
                fontFamily: "'Hanken Grotesk', sans-serif",
                color: '#333',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
              }}
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl outline-none text-xs"
              style={{
                border: '1px solid #E8E0E0',
                fontFamily: "'Hanken Grotesk', sans-serif",
                color: dateFrom ? '#333' : '#A18D8D',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                background: '#fff',
              }}
            />
            <span style={{ color: '#A18D8D', fontSize: 12 }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl outline-none text-xs"
              style={{
                border: '1px solid #E8E0E0',
                fontFamily: "'Hanken Grotesk', sans-serif",
                color: dateTo ? '#333' : '#A18D8D',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                background: '#fff',
              }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: '#BE123C', background: '#FFF1F2', border: '1px solid #FECDD3', fontFamily: "'Hanken Grotesk', sans-serif" }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {DOC_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  background: statusFilter === s ? '#156D07' : '#FFFFFF',
                  color:      statusFilter === s ? '#FFFFFF' : '#827575',
                  border:     statusFilter === s ? 'none' : '1px solid #E8E0E0',
                  boxShadow:  '0 1px 3px rgba(0,0,0,0.07)',
                }}
              >
                {s}
              </button>
            ))}

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                background: '#FFFFFF',
                color: '#1D6DB5',
                border: '1px solid #BFDBFE',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              }}
            >
              <FiDownload size={12} />
              Export CSV
            </button>
          </div>
          </div>
        </div>

        {/* ── Table card ── */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>

          <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
              Document Requests
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-xs"
                style={{ background: '#F0FDF4', color: '#156D07', fontFamily: "'Hanken Grotesk', sans-serif" }}
              >
                {filtered.length}
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <FiLoader size={24} color="#156D07" className="animate-spin" />
                <span className="ml-3 text-sm" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  Loading requests…
                </span>
              </div>
            ) : (
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['#', 'Request ID', 'Name', 'Contact', 'Document Type', 'Purpose', 'Status', 'Payment', 'Date', 'Update Status', 'Print'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3"
                        style={{
                          fontFamily: "'Kaisei Decol', serif",
                          color: '#A18D8D',
                          fontSize: 12,
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {paged.map((req, idx) => {
                    const isCompleted = norm(req.status) === 'completed';
                    const canPrint = !isCompleted && norm(req.paymentStatus) === 'paid' && ['processing'].includes(norm(req.status));
                    return (
                    <tr
                      key={req._id}
                      style={{ borderTop: '1px solid #F5F0F0', opacity: isCompleted ? 0.6 : 1 }}
                      className="transition-colors"
                    >
                      {/* # */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>

                      {/* Request ID — last 6 hex chars */}
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-xs px-2 py-0.5 rounded-lg"
                          style={{ background: '#F0FDF4', color: '#156D07', fontFamily: 'monospace' }}
                        >
                          {String(req._id).slice(-6).toUpperCase()}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {req.profile?.fullName || req.user?.username || <span style={{ color: '#C0B0B0' }}>—</span>}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif", whiteSpace: 'nowrap' }}>
                        {req.user?.contactNumber || req.user?.email || <span style={{ color: '#C0B0B0' }}>—</span>}
                      </td>

                      {/* Document Type */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#555', fontFamily: "'Hanken Grotesk', sans-serif", maxWidth: 140 }}>
                        {req.documentType || '—'}
                      </td>

                      {/* Purpose */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif", maxWidth: 120 }}>
                        {req.purpose || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <DocStatusBadge status={req.status} />
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3">
                        <PayBadge status={req.paymentStatus} />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif", whiteSpace: 'nowrap' }}>
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>

                      {/* Update Status */}
                      <td className="px-4 py-3">
                        <select
                          disabled={isCompleted || norm(req.paymentStatus) !== 'paid' || updatingId === req._id}
                          value={req.status}
                          onChange={(e) => handleStatusChange(req._id, e.target.value)}
                          className="text-xs rounded-lg px-2 py-1 border outline-none"
                          style={{
                            color: isCompleted || norm(req.paymentStatus) !== 'paid' ? '#C0B0B0' : '#156D07',
                            borderColor: isCompleted || norm(req.paymentStatus) !== 'paid' ? '#E8E0E0' : '#D1E8CF',
                            fontFamily: "'Hanken Grotesk', sans-serif",
                            background: isCompleted || norm(req.paymentStatus) !== 'paid' || updatingId === req._id ? '#F5F5F5' : '#FFFFFF',
                            cursor: isCompleted || norm(req.paymentStatus) !== 'paid' ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {['Pending', 'Processing', 'Printing', 'Completed', 'Rejected'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Print */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPrinting(req)}
                          disabled={!canPrint}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                          style={{
                            fontFamily: "'Hanken Grotesk', sans-serif",
                            ...(canPrint
                              ? { background: '#F0FDF4', color: '#156D07', border: '1px solid #BBF7D0', cursor: 'pointer' }
                              : { background: '#F5F5F5', color: '#C0B0B0', border: '1px solid #E8E0E0', cursor: 'not-allowed' }
                            ),
                          }}
                        >
                          <FiPrinter size={12} />
                          Print
                        </button>
                      </td>
                    </tr>
                  );
                  })}

                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-12 text-center" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13 }}>
                        No requests found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Pagination ── */}
          {!loading && sorted.length > PAGE_SIZE && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid #F0EAEA' }}
            >
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                  style={{
                    borderColor: '#E8E0E0',
                    background: page === 1 ? '#F9F9F9' : '#FFFFFF',
                    color: page === 1 ? '#C0B0B0' : '#156D07',
                  }}
                >
                  <FiChevronLeft size={15} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                  style={{
                    borderColor: '#E8E0E0',
                    background: page === totalPages ? '#F9F9F9' : '#FFFFFF',
                    color: page === totalPages ? '#C0B0B0' : '#156D07',
                  }}
                >
                  <FiChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SecretaryLayout>
    </div>

    {/* Print document modal */}
    {printing && (
      <PrintDocumentModal
        request={printing}
        onClose={() => setPrinting(null)}
      />
    )}
    </>
  );
}
