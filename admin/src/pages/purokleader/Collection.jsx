import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FiSearch, FiDownload, FiChevronLeft, FiChevronRight,
  FiCheckCircle, FiXCircle, FiClock, FiAlertCircle,
} from 'react-icons/fi';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';

const PAGE_SIZE = 15;

const PAY_STATUS = {
  paid:    { bg: '#F0FDF4', color: '#156D07', label: 'Paid'    },
  unpaid:  { bg: '#FFF7ED', color: '#C2610A', label: 'Unpaid'  },
  free:    { bg: '#F3F0FF', color: '#7C3AED', label: 'Free'    },
};

const REQ_STATUS = {
  pending:    { bg: '#FFF7ED', color: '#C2610A', label: 'Pending'    },
  processing: { bg: '#EFF6FF', color: '#1D6DB5', label: 'Processing' },
  approved:   { bg: '#F0FDF4', color: '#156D07', label: 'Approved'   },
  completed:  { bg: '#F0FDF4', color: '#156D07', label: 'Completed'  },
  rejected:   { bg: '#FFF1F2', color: '#BE123C', label: 'Rejected'   },
};

function PayBadge({ status }) {
  const s   = (status || '').toLowerCase();
  const cfg = PAY_STATUS[s] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {s === 'paid'   && <FiCheckCircle size={10} />}
      {s === 'unpaid' && <FiAlertCircle size={10} />}
      {s === 'free'   && <FiCheckCircle size={10} />}
      {cfg.label}
    </span>
  );
}

function ReqBadge({ status }) {
  const s   = (status || '').toLowerCase();
  const cfg = REQ_STATUS[s] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {(s === 'approved' || s === 'completed') && <FiCheckCircle size={10} />}
      {s === 'rejected'                        && <FiXCircle size={10} />}
      {(s === 'pending' || s === 'processing') && <FiClock size={10} />}
      {cfg.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
  });
}

function formatFee(feecentavos) {
  if (feecentavos == null) return '—';
  return '₱' + (feecentavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportPDF(rows, purok, feecentavos) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(13);
  doc.setTextColor(124, 58, 237);
  doc.text(`Document Requests — ${purok}`, 14, 14);

  doc.setFontSize(8);
  doc.setTextColor(161, 141, 141);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH', { hour12: true })}`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [['#', 'Resident', 'Document Type', 'Purpose', 'Amount Paid', 'Payment', 'Status', 'Date']],
    body: rows.map((r, i) => [
      i + 1,
      r.profile?.fullName || r.user?.username || '—',
      r.documentType  || '—',
      r.purpose       || '—',
      (r.paymentStatus || '').toLowerCase() === 'unpaid' ? '—' : (feecentavos != null ? '₱' + (feecentavos / 100).toFixed(2) : '—'),
      (PAY_STATUS[(r.paymentStatus || '').toLowerCase()]?.label) || r.paymentStatus || '—',
      r.status        || '—',
      formatDate(r.createdAt),
    ]),
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [55, 65, 81] },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: {
      0: { cellWidth: 8  },
      1: { cellWidth: 40 },
      2: { cellWidth: 38 },
      3: { cellWidth: 40 },
      4: { cellWidth: 22 },
      5: { cellWidth: 20 },
      6: { cellWidth: 22 },
      7: { cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
    styles: { overflow: 'linebreak' },
  });

  doc.save(`collection-${purok.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const PAY_TABS = ['All', 'Paid', 'Unpaid'];

export default function PurokLeaderCollection() {
  const { user } = useAuthStore();
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [feecentavos,  setFeecentavos]  = useState(null);
  const [search,       setSearch]       = useState('');
  const [payTab,       setPayTab]       = useState('All');
  const [page,         setPage]         = useState(1);

  useEffect(() => {
    Promise.all([
      api.get('/requests'),
      api.get('/purok-clearance/my-fee'),
    ])
      .then(([reqRes, feeRes]) => {
        setRequests(reqRes.data);
        setFeecentavos(feeRes.data?.feecentavos ?? null);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [search, payTab]);

  const filtered = useMemo(() => {
    const myPurok = (user?.purok || '').toLowerCase();

    return requests.filter((r) => {
      // filter to this purok leader's purok
      const rPurok = (r.profile?.purok || r.profile?.address || '').toLowerCase();
      if (myPurok && !rPurok.includes(myPurok)) return false;

      // payment tab
      if (payTab !== 'All') {
        const ps = (r.paymentStatus || '').toLowerCase();
        if (payTab === 'Paid'   && ps !== 'paid'  && ps !== 'free') return false;
        if (payTab === 'Unpaid' && ps !== 'unpaid')                  return false;
      }

      // search
      const q = search.toLowerCase();
      if (q) {
        const name = (r.profile?.fullName || r.user?.username || '').toLowerCase();
        const hit  =
          name.includes(q) ||
          (r.documentType || '').toLowerCase().includes(q) ||
          (r.purpose      || '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [requests, user, search, payTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const tabCounts = useMemo(() => {
    const myPurok = (user?.purok || '').toLowerCase();
    const mine = requests.filter((r) => {
      const rPurok = (r.profile?.purok || r.profile?.address || '').toLowerCase();
      return !myPurok || rPurok.includes(myPurok);
    });
    const paid   = mine.filter((r) => { const ps = (r.paymentStatus||'').toLowerCase(); return ps==='paid'||ps==='free'; }).length;
    const unpaid = mine.filter((r) => (r.paymentStatus||'').toLowerCase()==='unpaid').length;
    return { All: mine.length, Paid: paid, Unpaid: unpaid };
  }, [requests, user]);

  return (
    <PurokLeaderLayout title="COLLECTION">
      <div className="flex flex-col gap-4">

        {/* Header card */}
        <div className="bg-white rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div>
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 18 }}>
              {user?.purok} — Document Requests
            </p>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 4 }}>
              {loading ? '…' : `${filtered.length} request${filtered.length !== 1 ? 's' : ''} found`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <FiSearch size={14} color="#A18D8D"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, document…"
                className="rounded-xl pl-8 pr-4 py-2 text-sm focus:outline-none"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  background: '#F9F7F7', border: '1px solid #E8E0E0',
                  color: '#333', width: 200,
                }}
              />
            </div>

            {/* Export PDF */}
            <button
              onClick={() => {
                if (filtered.length === 0) { toast.error('No data to export.'); return; }
                exportPDF(filtered, user?.purok || 'Purok', feecentavos);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ fontFamily: "'Hahmlet', sans-serif", background: '#7C3AED' }}
            >
              <FiDownload size={14} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Payment status tabs */}
        <div className="flex gap-2">
          {PAY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setPayTab(tab)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                background: payTab === tab ? '#7C3AED' : '#FFFFFF',
                color:      payTab === tab ? '#FFFFFF'  : '#A18D8D',
                boxShadow:  '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              {tab}
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  background: payTab === tab ? 'rgba(255,255,255,0.25)' : '#F3F0FF',
                  color:      payTab === tab ? '#FFFFFF' : '#7C3AED',
                }}>
                {tabCounts[tab] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0EAEA' }}>
                  {['#', 'RESIDENT', 'DOCUMENT TYPE', 'PURPOSE', 'AMOUNT PAID', 'PAYMENT', 'STATUS', 'DATE'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left"
                      style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 12, fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>Loading…</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>No requests found</td></tr>
                )}
                {!loading && visible.map((r, idx) => (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: '1px solid #FAF7F7' }}>

                    <td className="px-4 py-3" style={{ color: '#C0B0B0', fontSize: 13 }}>
                      {(safePage - 1) * PAGE_SIZE + idx + 1}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: '#7C3AED' }}>
                          {(r.profile?.fullName || r.user?.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                          {r.profile?.fullName || r.user?.username || '—'}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 12, fontWeight: 600 }}>
                        {r.documentType || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {r.purpose || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                        {(r.paymentStatus || '').toLowerCase() === 'unpaid' ? '—' : formatFee(feecentavos)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <PayBadge status={r.paymentStatus} />
                    </td>

                    <td className="px-4 py-3">
                      <ReqBadge status={r.status} />
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {formatDate(r.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                Page {safePage} of {totalPages} · {filtered.length} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-40"
                  style={{ background: '#F3F0FF' }}
                >
                  <FiChevronLeft size={15} color="#7C3AED" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-40"
                  style={{ background: '#F3F0FF' }}
                >
                  <FiChevronRight size={15} color="#7C3AED" />
                </button>
              </div>
            </div>
          )}

          {!loading && totalPages <= 1 && (
            <div className="px-5 py-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                {filtered.length} request{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

      </div>
    </PurokLeaderLayout>
  );
}
