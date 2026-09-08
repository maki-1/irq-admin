import { useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiX, FiDownload, FiFilter } from 'react-icons/fi';
import toast from 'react-hot-toast';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { exportReportPDF, exportReportXLSX } from '../../utils/reportExport';

const TABS     = ['Pending', 'Approved', 'Rejected'];
const PAGE_SIZE = 10;

const STATUS_STYLE = {
  pending:  { bg: '#FFF7ED', color: '#B45309' },
  approved: { bg: '#F0FDF4', color: '#156D07' },
  rejected: { bg: '#FEF2F2', color: '#DC2626' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status?.toLowerCase()] || { bg: '#F5F5F5', color: '#888' };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: s.bg, color: s.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {status}
    </span>
  );
}

function ActionModal({ request, action, onClose, onDone }) {
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving]   = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await api.patch(`/purok-leader/requests/${request._id}/${action}`, { remarks });
      toast.success(`Request ${action}d`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: isApprove ? '#156D07' : '#DC2626', fontSize: 18 }}>
            {isApprove ? 'Approve Request' : 'Reject Request'}
          </p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <FiX size={18} color="#827575" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 13, marginBottom: 12 }}>
            <strong>{request.profile?.fullName || request.user?.username}</strong> — {request.documentType}
          </p>
          <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
            Remarks {!isApprove && <span style={{ color: '#DC2626' }}>*</span>}
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder={isApprove ? 'Optional notes…' : 'State the reason for rejection…'}
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
          />
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={saving || (!isApprove && !remarks.trim())}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: isApprove ? '#156D07' : '#DC2626' }}>
            {saving ? 'Saving…' : isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurokLeaderRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('Pending');
  const [modal, setModal]       = useState(null);
  const [search, setSearch]     = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [page, setPage]         = useState(1);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/purok-leader/requests');
      const sorted = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRequests(sorted);
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [tab, search, docTypeFilter]);

  const docTypes = [...new Set(requests.map((r) => r.documentType).filter(Boolean))];

  const filtered = requests.filter((r) => {
    const matchTab    = r.purokLeaderStatus?.toLowerCase() === tab.toLowerCase();
    const name        = (r.profile?.fullName || r.user?.username || '').toLowerCase();
    const matchSearch = !search ||
      name.includes(search.toLowerCase()) ||
      r.documentType?.toLowerCase().includes(search.toLowerCase());
    const matchType   = !docTypeFilter || r.documentType === docTypeFilter;
    return matchTab && matchSearch && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pending    = requests.filter((r) => r.purokLeaderStatus === 'pending').length;

  const REQ_COLUMNS = ['#', 'Resident Name', 'Document Type', 'Purpose', 'Date Requested', 'Status', 'Remarks'];
  const reqReport = () => ({
    title: 'Purok Leader Requests',
    subtitle: `${tab} · ${user?.purok || ''}`.trim(),
    columns: REQ_COLUMNS,
    rows: filtered.map((r, i) => [
      i + 1,
      r.profile?.fullName || r.user?.username || '—',
      r.documentType || '—',
      r.purpose || '—',
      new Date(r.createdAt).toLocaleDateString('en-PH'),
      r.purokLeaderStatus || '—',
      r.purokLeaderRemarks || '',
    ]),
    user,
    filename: `purok-requests-${tab.toLowerCase()}`,
  });

  async function exportExcel() {
    try { await exportReportXLSX({ ...reqReport(), sheetName: `${tab} Requests` }); }
    catch { toast.error('Excel export failed'); }
  }
  async function exportPDF() {
    try { await exportReportPDF({ ...reqReport(), orientation: 'landscape' }); }
    catch { toast.error('PDF export failed'); }
  }

  /* page number list with ellipsis */
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);

  return (
    <PurokLeaderLayout title="Requests">
      {modal && (
        <ActionModal
          request={modal.request}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={load}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or document…"
          className="flex-1 min-w-[180px] rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#FFFFFF', border: '1px solid #E8E0E0', color: '#333' }}
        />
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: '#FFFFFF', border: '1px solid #E8E0E0' }}>
          <FiFilter size={14} color="#827575" />
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="text-sm focus:outline-none bg-transparent"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555' }}>
            <option value="">All Types</option>
            {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#F0FDF4', color: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
          <FiDownload size={14} /> Export Excel
        </button>
        <button onClick={exportPDF}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#156D07', color: '#FFFFFF', fontFamily: "'Hahmlet', sans-serif" }}>
          <FiDownload size={14} /> Export PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => {
          const isActive = tab === t;
          const count    = t === 'Pending' ? pending : null;
          return (
            <button key={t} onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ fontFamily: "'Hahmlet', sans-serif", background: isActive ? '#156D07' : '#FFFFFF', color: isActive ? '#FFFFFF' : '#827575' }}>
              {t}
              {count != null && count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: isActive ? 'rgba(255,255,255,0.25)' : '#FFF7ED', color: isActive ? '#fff' : '#B45309' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 16 }}>
            No {tab.toLowerCase()} requests
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #F0EAEA' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ background: '#F9F7F7', borderBottom: '1px solid #F0EAEA' }}>
                    {['#', 'Resident', 'Document Type', 'Purpose', 'Date', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold"
                        style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r, idx) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid #F9F7F7' }}
                      className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#1E1E1E', fontFamily: "'Kaisei Decol', serif" }}>
                          {r.profile?.fullName || r.user?.username || '—'}
                          {r.channel === 'kiosk' && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: '#EFF6FF', color: '#2563EB', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                              KIOSK
                            </span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                          {r.profile?.address || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap"
                        style={{ color: '#555', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {r.documentType || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[160px]"
                        style={{ color: '#555', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        <span className="line-clamp-2">{r.purpose || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap"
                        style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {new Date(r.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.purokLeaderStatus} />
                        {r.purokLeaderRemarks && (
                          <p className="text-xs mt-1" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif", maxWidth: 140 }}>
                            {r.purokLeaderRemarks}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.purokLeaderStatus?.toLowerCase() === 'pending' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setModal({ request: r, action: 'approve' })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                              style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
                              <FiCheckCircle size={12} /> Approve
                            </button>
                            <button
                              onClick={() => setModal({ request: r, action: 'reject' })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                              style={{ background: '#FEF2F2', color: '#DC2626', fontFamily: "'Hahmlet', sans-serif" }}>
                              <FiXCircle size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: '#C0B0B0' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 px-1 flex-wrap gap-2">
            <p className="text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
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
                      background: p === page ? '#156D07' : '#FFFFFF',
                      color:      p === page ? '#FFFFFF' : '#555',
                      border:     '1px solid #E8E0E0',
                      fontFamily: "'Hahmlet', sans-serif",
                    }}>
                    {p}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                style={{ background: '#FFFFFF', border: '1px solid #E8E0E0', color: '#555', fontFamily: "'Hahmlet', sans-serif" }}>
                Next ›
              </button>
            </div>
          </div>
        </>
      )}
    </PurokLeaderLayout>
  );
}
