import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FiSearch, FiDownload, FiChevronLeft, FiChevronRight,
  FiCheckCircle, FiXCircle, FiClock,
} from 'react-icons/fi';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';

const PAGE_SIZE = 15;

const STATUS_CFG = {
  pending:       { bg: '#FFF7ED', color: '#C2610A', label: 'Pending'      },
  submitted:     { bg: '#EFF6FF', color: '#1D6DB5', label: 'Submitted'    },
  'under review':{ bg: '#EFF6FF', color: '#1D6DB5', label: 'Under Review' },
  approved:      { bg: '#F0FDF4', color: '#156D07', label: 'Approved'     },
  rejected:      { bg: '#FFF1F2', color: '#BE123C', label: 'Rejected'     },
};

const normStatus = (s) => (s || '').toLowerCase();

function StatusBadge({ status }) {
  const ns  = normStatus(status);
  const cfg = STATUS_CFG[ns] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {ns === 'approved'                              && <FiCheckCircle size={10} />}
      {ns === 'rejected'                              && <FiXCircle size={10} />}
      {(ns === 'under review' || ns === 'submitted')  && <FiClock size={10} />}
      {cfg.label}
    </span>
  );
}

function exportPDF(rows, purok) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(13);
  doc.setTextColor(124, 58, 237);
  doc.text(`Residents — ${purok}`, 14, 14);

  doc.setFontSize(8);
  doc.setTextColor(161, 141, 141);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH', { hour12: true })}`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [['#', 'Full Name', 'Address / Purok', 'Contact', 'Email', 'Gender', 'Civil Status', 'Status']],
    body: rows.map((p, i) => [
      i + 1,
      p.fullName   || '—',
      p.purok || p.address || '—',
      p.contactNumber || '—',
      p.email      || '—',
      p.gender     || '—',
      p.civilStatus || '—',
      normStatus(p.status) ? STATUS_CFG[normStatus(p.status)]?.label || p.status : '—',
    ]),
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [55, 65, 81] },
    alternateRowStyles: { fillColor: [248, 245, 255] },
    columnStyles: {
      0: { cellWidth: 8  },
      1: { cellWidth: 40 },
      2: { cellWidth: 45 },
      3: { cellWidth: 28 },
      4: { cellWidth: 40 },
      5: { cellWidth: 18 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
    styles: { overflow: 'linebreak' },
  });

  doc.save(`residents-${purok.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function PurokLeaderResidence() {
  const { user } = useAuthStore();
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);

  useEffect(() => {
    api.get('/verifications')
      .then(({ data }) => setProfiles(data.filter((p) => p.facePhoto)))
      .catch(() => toast.error('Failed to load residents'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [search]);

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.fullName?.toLowerCase().includes(q) ||
      p.purok?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <PurokLeaderLayout title="RESIDENTS">
      <div className="flex flex-col gap-4">

        {/* Header card */}
        <div className="bg-white rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div>
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 18 }}>
              {user?.purok} — Residents
            </p>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 4 }}>
              {loading ? '…' : `${filtered.length} resident${filtered.length !== 1 ? 's' : ''} found`}
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
                placeholder="Search name, address…"
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
                exportPDF(filtered, user?.purok || 'Purok');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ fontFamily: "'Hahmlet', sans-serif", background: '#7C3AED' }}
            >
              <FiDownload size={14} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F0EAEA' }}>
                  {['#', 'FULL NAME', 'ADDRESS / PUROK', 'CONTACT', 'EMAIL', 'GENDER', 'STATUS'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left"
                      style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 12, fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>Loading…</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>No residents found</td></tr>
                )}
                {!loading && visible.map((p, idx) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: '1px solid #FAF7F7' }}>

                    <td className="px-4 py-3" style={{ color: '#C0B0B0', fontSize: 13 }}>
                      {(safePage - 1) * PAGE_SIZE + idx + 1}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: '#7C3AED' }}>
                          {p.fullName?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                          {p.fullName || '—'}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {p.purok || p.address || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {p.contactNumber || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {p.email || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {p.gender || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
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
                {filtered.length} resident{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

      </div>
    </PurokLeaderLayout>
  );
}
