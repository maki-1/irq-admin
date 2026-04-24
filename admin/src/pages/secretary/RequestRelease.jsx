import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSearch, FiLoader, FiDownload, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { getReleases, updateClaimStatus } from '../../services/request.service';
import SecretaryLayout from '../../components/layouts/SecretaryLayout';

const PAGE_SIZE = 10;

export default function RequestRelease() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page, setPage]         = useState(1);
  const [updatingId, setUpdating] = useState(null);

  useEffect(() => {
    setLoading(true);
    getReleases()
      .then((r) => setReleases(r.data))
      .catch(() => toast.error('Failed to load releases'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  const handleClaimStatus = async (id, claimStatus) => {
    setUpdating(id);
    try {
      await updateClaimStatus(id, claimStatus);
      setReleases((prev) =>
        prev.map((r) => r._id === id ? { ...r, claimStatus } : r)
      );
      toast.success(`Marked as ${claimStatus}`);
    } catch {
      toast.error('Failed to update claim status');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = releases.filter((r) => {
    const q = search.toLowerCase();
    const name = (r.fullName || r.user?.username || '').toLowerCase();
    const matchSearch =
      !q ||
      name.includes(q) ||
      (r.documentType || '').toLowerCase().includes(q) ||
      (r.claimCode || '').toLowerCase().includes(q) ||
      (r.purpose || '').toLowerCase().includes(q);
    const completed = r.completedAt ? new Date(r.completedAt) : null;
    const matchFrom = !dateFrom || (completed && completed >= new Date(dateFrom));
    const matchTo   = !dateTo   || (completed && completed <= new Date(dateTo + 'T23:59:59'));
    return matchSearch && matchFrom && matchTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['#', 'Claim Code', 'Name', 'Document Type', 'Purpose', 'Purok', 'Completed Date'];
    const rows = filtered.map((r, i) => [
      i + 1,
      r.claimCode || '',
      r.fullName || r.user?.username || '',
      r.documentType || '',
      r.purpose || '',
      r.purok || '',
      r.completedAt
        ? new Date(r.completedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
        : '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `releases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    border: '1px solid #E8E0E0',
    fontFamily: "'Hanken Grotesk', sans-serif",
    color: '#333',
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
    background: '#fff',
  };

  return (
    <SecretaryLayout title="REQUEST RELEASE">
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <FiSearch
                size={15} color="#A18D8D"
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search by name, document type, claim code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl outline-none text-sm"
                style={inputStyle}
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-xl outline-none text-xs"
                style={{ ...inputStyle, color: dateFrom ? '#333' : '#A18D8D' }}
              />
              <span style={{ color: '#A18D8D', fontSize: 12 }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-xl outline-none text-xs"
                style={{ ...inputStyle, color: dateTo ? '#333' : '#A18D8D' }}
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

            {/* Export */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
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

        {/* ── Table ── */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
              Completed Documents
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
                  Loading…
                </span>
              </div>
            ) : (
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['#', 'Claim Code', 'Name', 'Document Type', 'Purpose', 'Purok', 'Completed Date', 'Action'].map((h) => (
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
                  {paged.map((r, idx) => (
                    <tr key={r._id} style={{ borderTop: '1px solid #F5F0F0' }} className="hover:bg-green-50 transition-colors">
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-xs px-2 py-1 rounded-lg tracking-widest"
                          style={{ background: '#F0FDF4', color: '#156D07' }}
                        >
                          {r.claimCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: '#333', fontFamily: "'Hanken Grotesk', sans-serif", whiteSpace: 'nowrap' }}>
                        {r.fullName || r.user?.username || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#555', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {r.documentType || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {r.purpose || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                        {r.purok || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif", whiteSpace: 'nowrap' }}>
                        {r.completedAt
                          ? new Date(r.completedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.claimStatus === 'claimed' ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: '#F0FDF4', color: '#156D07', fontFamily: "'Hanken Grotesk', sans-serif" }}
                          >
                            Claimed
                          </span>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              disabled={updatingId === r._id}
                              onClick={() => handleClaimStatus(r._id, 'claimed')}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                fontFamily: "'Hanken Grotesk', sans-serif",
                                background: '#F0FDF4',
                                color: '#156D07',
                                border: '1px solid #BBF7D0',
                                cursor: updatingId === r._id ? 'not-allowed' : 'pointer',
                                opacity: updatingId === r._id ? 0.6 : 1,
                              }}
                            >
                              Claimed
                            </button>
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: '#FFF7ED', color: '#C2610A', fontFamily: "'Hanken Grotesk', sans-serif" }}
                            >
                              Pending
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13 }}>
                        No completed documents found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #F0EAEA' }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                {filtered.length} record{filtered.length !== 1 ? 's' : ''} &mdash; Page {page} of {totalPages}
              </span>
              <div className="flex gap-1.5 items-center">
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

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce((acc, n, i, arr) => {
                    if (i > 0 && n - arr[i - 1] > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === '…' ? (
                      <span key={`ellipsis-${i}`} style={{ color: '#A18D8D', fontSize: 12, padding: '0 2px' }}>…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-medium transition-colors"
                        style={{
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          borderColor: page === item ? '#156D07' : '#E8E0E0',
                          background: page === item ? '#156D07' : '#FFFFFF',
                          color: page === item ? '#FFFFFF' : '#555',
                        }}
                      >
                        {item}
                      </button>
                    )
                  )}

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
  );
}
