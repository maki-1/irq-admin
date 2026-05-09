import { useEffect, useState, useMemo } from 'react';
import { FiPrinter, FiFileText } from 'react-icons/fi';
import CollectorLayout from '../../components/layouts/CollectorLayout';
import PrintReceiptModal from '../../components/common/PrintReceiptModal';
import { getRequests } from '../../services/request.service';
import api from '../../services/api';

const DOLOGON_LOGO = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776233357/irequestdologon/assets/DOLOGONLOGO.jpg';
const MARAMAG_LOGO  = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776233358/irequestdologon/assets/MARAMAGLOGO.jpg';

const TABS = ['All', 'Paid', 'Unpaid'];

const STATUS_STYLE = {
  paid:   { bg: '#F0FDF4', color: '#156D07' },
  unpaid: { bg: '#FFF7ED', color: '#B45309' },
};

function StatusBadge({ status }) {
  const s = status?.toLowerCase() || 'unpaid';
  const style = STATUS_STYLE[s] || { bg: '#F5F5F5', color: '#888' };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: style.bg, color: style.color, fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {status || '—'}
    </span>
  );
}

export default function CollectorPayments() {
  const [requests, setRequests] = useState([]);
  const [feeMap,   setFeeMap]   = useState({}); // purokName.toLowerCase() -> feecentavos
  const [tab, setTab]           = useState('All');
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [printReq, setPrintReq] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getRequests(),
      api.get('/purok-clearance/all-fees'),
    ])
      .then(([reqResult, feeResult]) => {
        if (reqResult.status === 'fulfilled') {
          setRequests(reqResult.value.data);
        } else {
          console.error('Failed to load requests:', reqResult.reason);
        }
        if (feeResult.status === 'fulfilled') {
          const map = {};
          (feeResult.value.data || []).forEach((f) => {
            if (f.purokName) map[f.purokName.toLowerCase()] = f.feecentavos;
          });
          setFeeMap(map);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const residentName = (req) => req.profile?.fullName || req.user?.username || '—';

  // Net amount collector receives: amountPaid minus the purok clearance fee
  const netAmount = (req) => {
    if (req.paymentStatus !== 'paid' || req.amountPaid == null) return null;
    const purok = (req.profile?.purok || req.profile?.address || '').toLowerCase();

    // exact match first
    let feecentavos = feeMap[purok];

    // partial match: feeMap key contained in purok string or vice versa
    if (feecentavos == null) {
      for (const [key, val] of Object.entries(feeMap)) {
        if (purok.includes(key) || key.includes(purok)) {
          feecentavos = val;
          break;
        }
      }
    }

    const fee = feecentavos != null ? feecentavos / 100 : 0;
    return Math.max(0, req.amountPaid - fee);
  };

  const filtered = useMemo(() => requests.filter((r) => {
    const matchTab =
      tab === 'All' ||
      (tab === 'Paid'   && r.paymentStatus === 'paid') ||
      (tab === 'Unpaid' && r.paymentStatus === 'unpaid');

    const name = residentName(r).toLowerCase();
    const matchSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      r.documentType?.toLowerCase().includes(search.toLowerCase());

    const created   = r.createdAt ? new Date(r.createdAt) : null;
    const matchFrom = !dateFrom || (created && created >= new Date(dateFrom));
    const matchTo   = !dateTo   || (created && created <= new Date(dateTo + 'T23:59:59'));

    return matchTab && matchSearch && matchFrom && matchTo;
  }), [requests, tab, search, dateFrom, dateTo]);

  const exportPDF = () => {
    const dateLabel = dateFrom || dateTo
      ? ` (${dateFrom || '…'} → ${dateTo || '…'})`
      : '';
    const generatedAt = new Date().toLocaleString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const rows = filtered.map((req, idx) => {
      const net = netAmount(req);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${residentName(req)}</td>
        <td>${req.documentType || '—'}</td>
        <td>${req.purpose || '—'}</td>
        <td style="color:#156D07;font-weight:700">${net != null ? '₱' + net.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—'}</td>
        <td>
          <span class="badge ${(req.paymentStatus || '').toLowerCase()}">
            ${req.paymentStatus || '—'}
          </span>
        </td>
        <td>${req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
      </tr>`;
    }).join('');

    const totalCollected = filtered
      .filter(r => r.paymentStatus === 'paid')
      .reduce((sum, r) => sum + (netAmount(r) || 0), 0);

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payments Report${dateLabel}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 24px; }
          .header { text-align: center; margin-bottom: 20px; }
          .logos  { display: flex; justify-content: center; gap: 12px; margin-bottom: 8px; }
          .logos img { width: 50px; height: 50px; object-fit: contain; }
          .header h1 { font-size: 15px; font-weight: 700; }
          .header p  { font-size: 11px; color: #555; margin-top: 2px; }
          .meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 12px; border-top: 2px solid #156D07; padding-top: 8px; }
          table { width: 100%; border-collapse: collapse; }
          thead tr { background: #156D07; color: #fff; }
          thead th { padding: 7px 10px; text-align: left; font-size: 11px; font-weight: 600; }
          tbody tr:nth-child(even) { background: #F9F9F9; }
          tbody td { padding: 6px 10px; border-bottom: 1px solid #EEE; font-size: 11px; }
          .badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; text-transform: capitalize; }
          .badge.paid   { background: #F0FDF4; color: #156D07; }
          .badge.unpaid { background: #FFF7ED; color: #B45309; }
          .summary { margin-top: 16px; display: flex; gap: 24px; justify-content: flex-end; font-size: 12px; }
          .summary span { font-weight: 700; color: #156D07; }
          .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #EEE; padding-top: 8px; }
          @media print { @page { size: A4 landscape; margin: 12mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logos">
            <img src="${DOLOGON_LOGO}" alt="" />
            <img src="${MARAMAG_LOGO}" alt="" />
          </div>
          <p style="font-size:10px;color:#555">Republic of the Philippines · Province of Bukidnon · Municipality of Maramag</p>
          <h1>BARANGAY DOLOGON</h1>
          <p style="margin-top:6px;font-size:13px;font-weight:700;color:#156D07;letter-spacing:1px">PAYMENTS REPORT${dateLabel.toUpperCase()}</p>
        </div>
        <div class="meta">
          <span>Filter: <strong>${tab}</strong>${dateFrom ? ' | From: <strong>' + dateFrom + '</strong>' : ''}${dateTo ? ' | To: <strong>' + dateTo + '</strong>' : ''}</span>
          <span>Generated: ${generatedAt}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Resident</th><th>Document Type</th><th>Purpose</th><th>Net Amount</th><th>Payment Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:16px;color:#999">No records</td></tr>'}</tbody>
        </table>
        <div class="summary">
          <span>Total Records: <span>${filtered.length}</span></span>
          &nbsp;&nbsp;
          <span>Total Collected: <span>₱${totalCollected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></span>
        </div>
        <div class="footer">Barangay Dologon, Maramag, Bukidnon &nbsp;·&nbsp; iRequestDologon System</div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <CollectorLayout title="PAYMENTS">
      <div className="flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex flex-col gap-3">

          {/* Row 1: Tabs + Export */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    fontFamily: "'Hahmlet', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 16px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    background: tab === t ? '#156D07' : '#FFFFFF',
                    color: tab === t ? '#FFFFFF' : '#A18D8D',
                    boxShadow: tab === t ? 'none' : '0 2px 4px rgba(0,0,0,0.08)',
                    transition: 'all 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{
                background: '#156D07',
                color: '#FFFFFF',
                fontFamily: "'Hahmlet', sans-serif",
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(21,109,7,0.25)',
              }}
            >
              <FiFileText size={13} />
              Export PDF
            </button>
          </div>

          {/* Row 2: Date range + Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 12, color: '#A18D8D', whiteSpace: 'nowrap' }}>From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F0EAEA',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  color: '#333',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 12, color: '#A18D8D', whiteSpace: 'nowrap' }}>To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F0EAEA',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  color: '#333',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                }}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  fontSize: 11,
                  color: '#B45309',
                  background: '#FFF7ED',
                  border: '1px solid #FDE68A',
                  borderRadius: 8,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                Clear dates
              </button>
            )}
            <input
              type="text"
              placeholder="Search name or document..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] sm:w-64 px-4 py-2 rounded-xl text-sm outline-none"
              style={{
                background: '#FFFFFF',
                border: '1px solid #F0EAEA',
                fontFamily: "'Hanken Grotesk', sans-serif",
                color: '#333',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
              }}
            />
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9F7F7' }}>
                  {['#', 'Resident', 'Document Type', 'Purpose', 'Net Amount', 'Payment Status', 'Date', 'Action'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3"
                      style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                      No records found.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((req, idx) => {
                  const net = netAmount(req);
                  return (
                    <tr
                      key={req._id}
                      style={{ borderTop: '1px solid #F5F0F0' }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                        {idx + 1}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                            style={{ background: '#156D07' }}
                          >
                            {residentName(req).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                              {residentName(req)}
                            </p>
                            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                              {req.profile?.purok || req.user?.email || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 13 }}>
                        {req.documentType || '—'}
                      </td>
                      <td className="px-5 py-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                        {req.purpose || '—'}
                      </td>
                      <td className="px-5 py-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>
                        {net != null ? `₱${net.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={req.paymentStatus} />
                      </td>
                      <td className="px-5 py-3" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(req.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        {req.paymentStatus === 'paid' && (
                          <button
                            onClick={() => setPrintReq(req)}
                            title="Print Receipt"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            style={{ background: '#F0FDF4', color: '#156D07', fontFamily: "'Hahmlet', sans-serif", border: '1px solid #BBF7D0' }}
                          >
                            <FiPrinter size={13} />
                            Print
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && (
            <div className="px-5 py-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                Showing {filtered.length} of {requests.length} records
              </p>
            </div>
          )}
        </div>
      </div>
      {printReq && (
        <PrintReceiptModal
          req={printReq}
          residentName={residentName(printReq)}
          onClose={() => setPrintReq(null)}
        />
      )}
    </CollectorLayout>
  );
}
