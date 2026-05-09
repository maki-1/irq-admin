import { useEffect, useState, useMemo } from 'react';
import { FiRefreshCw, FiDownload, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import useAuthStore from '../../store/authStore';
import SecretaryLayout from '../../components/layouts/SecretaryLayout';
import CollectorLayout from '../../components/layouts/CollectorLayout';
import CaptainLayout from '../../components/layouts/CaptainLayout';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';
import { getAuditLogs } from '../../services/audit.service';

const LAYOUTS = {
  Secretary: SecretaryLayout,
  Collector: CollectorLayout,
  'Barangay Captain': CaptainLayout,
  'Purok Leader': PurokLeaderLayout,
};

const ROLE_COLORS = {
  Secretary:          { bg: '#EFF6FF', color: '#1D4ED8' },
  Collector:          { bg: '#FFF7ED', color: '#B45309' },
  'Barangay Captain': { bg: '#F0FDF4', color: '#156D07' },
};

const PAGE_SIZE = 15;

function RoleBadge({ role }) {
  const style = ROLE_COLORS[role] || { bg: '#F5F5F5', color: '#555' };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: style.bg, color: style.color, fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {role || '—'}
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

function exportPDF(rows, dateFrom, dateTo) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(14);
  doc.setTextColor(21, 109, 7);
  doc.text('iRequestDologon – Activity Logs', 14, 14);

  doc.setFontSize(9);
  doc.setTextColor(130, 117, 117);
  const rangeLabel =
    dateFrom || dateTo
      ? `Date range: ${dateFrom || 'start'} → ${dateTo || 'now'}`
      : 'Date range: All time';
  doc.text(`Generated: ${new Date().toLocaleString('en-PH', { hour12: true })}   ${rangeLabel}`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [['Time', 'User', 'Role', 'Action', 'Details']],
    body: rows.map((log) => [
      formatTime(log.createdAt),
      log.username || '—',
      log.role || '—',
      log.action || '—',
      log.details || '—',
    ]),
    headStyles: {
      fillColor: [21, 109, 7],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8, textColor: [55, 65, 81] },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 32 },
      2: { cellWidth: 32 },
      3: { cellWidth: 44 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
    styles: { overflow: 'linebreak' },
  });

  doc.save(`activity-logs-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function Logs() {
  const { user } = useAuthStore();
  const Layout = LAYOUTS[user?.role] || SecretaryLayout;

  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [page, setPage]           = useState(1);

  const fetchLogs = () => {
    setLoading(true);
    getAuditLogs()
      .then((r) => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, []);

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setPage(1); }, [search, roleFilter, dateFrom, dateTo]);

  const roles = ['All', 'Secretary', 'Collector', 'Barangay Captain'];

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null;

    return logs.filter((log) => {
      if (roleFilter !== 'All' && log.role !== roleFilter) return false;

      if (from || to) {
        const t = new Date(log.createdAt);
        if (from && t < from) return false;
        if (to   && t > to)   return false;
      }

      const q = search.toLowerCase();
      if (q) {
        const hit =
          log.username?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q) ||
          log.details?.toLowerCase().includes(q) ||
          log.role?.toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [logs, search, roleFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inputStyle = {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    fontFamily: "'Hanken Grotesk', sans-serif",
    color: '#374151',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  return (
    <Layout title="LOGS">
      <div className="flex flex-col gap-4">

        {/* ── Row 1: Search + role tabs + refresh ── */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, action, details…"
            className="flex-1 min-w-48 px-4 py-2 rounded-xl text-sm outline-none"
            style={inputStyle}
          />

          <div className="flex gap-1 bg-white rounded-xl p-1" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  background: roleFilter === r ? '#156D07' : 'transparent',
                  color: roleFilter === r ? '#FFFFFF' : '#827575',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLogs}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            title="Refresh"
          >
            <FiRefreshCw size={16} color="#156D07" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ── Row 2: Date range + export ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#827575', fontSize: 12 }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex items-center gap-2">
            <label style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#827575', fontSize: 12 }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 rounded-xl text-xs transition-colors hover:bg-gray-100"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              Clear
            </button>
          )}

          <button
            onClick={() => exportPDF(filtered, dateFrom, dateTo)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-40"
            style={{ background: '#156D07', color: '#fff', fontFamily: "'Hanken Grotesk', sans-serif", boxShadow: '0 2px 6px rgba(21,109,7,0.25)' }}
          >
            <FiDownload size={15} />
            Export PDF
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>

          {/* Header */}
          <div
            className="grid gap-3 px-5 py-3"
            style={{ gridTemplateColumns: '170px 140px 130px 1fr 1fr', borderBottom: '1px solid #F0EAEA' }}
          >
            {['TIME', 'USER', 'ROLE', 'ACTION', 'DETAILS'].map((h) => (
              <span key={h} style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11, fontWeight: 700 }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div className="py-12 text-center" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13 }}>
              Loading…
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13 }}>
              No logs found
            </div>
          ) : (
            <ul>
              {paginated.map((log) => (
                <li
                  key={log._id}
                  className="grid gap-3 px-5 py-3 items-center hover:bg-gray-50 transition-colors"
                  style={{ gridTemplateColumns: '170px 140px 130px 1fr 1fr', borderBottom: '1px solid #FAF7F7' }}
                >
                  <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#374151', fontSize: 11, lineHeight: 1.4 }}>
                    {formatTime(log.createdAt)}
                  </span>

                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                      style={{ background: '#156D07' }}
                    >
                      {log.username?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#374151', fontSize: 12, fontWeight: 600 }}>
                      {log.username || '—'}
                    </span>
                  </div>

                  <RoleBadge role={log.role} />

                  <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 600 }}>
                    {log.action || '—'}
                  </span>

                  <span className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#827575', fontSize: 12 }}>
                    {log.details || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* ── Footer: count + pagination ── */}
          {!loading && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid #F0EAEA' }}
            >
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 11 }}>
                {filtered.length === 0
                  ? '0 entries'
                  : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} entries`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{ background: page === 1 ? '#F5F5F5' : '#F0FDF4' }}
                >
                  <FiChevronLeft size={16} color="#156D07" />
                </button>

                {/* Page number buttons */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} style={{ color: '#C0B0B0', fontSize: 12, paddingInline: 4 }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          background: page === p ? '#156D07' : '#F5F5F5',
                          color: page === p ? '#fff' : '#827575',
                        }}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{ background: page === totalPages ? '#F5F5F5' : '#F0FDF4' }}
                >
                  <FiChevronRight size={16} color="#156D07" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
