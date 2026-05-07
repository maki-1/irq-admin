import { useEffect, useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import { getRequests } from '../../services/request.service';
import { getVerificationStats, getPurokStats } from '../../services/verification.service';
import CaptainLayout from '../../components/layouts/CaptainLayout';
import assets from '../../assets/cloudinaryAssets';

/* ── palette ── */
const GREEN = '#156D07';

const DOC_COLORS   = ['#156D07', '#2E7D32', '#66BB6A'];
const STATUS_COLORS = {
  Pending:    '#F59E0B',
  Processing: '#3B82F6',
  Printing:   '#8B5CF6',
  Completed:  '#156D07',
  Rejected:   '#EF4444',
};
const PUROK_COLORS = ['#156D07','#2E7D32','#388E3C','#43A047','#4CAF50','#66BB6A','#81C784','#A5D6A7'];

/* ── shared tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      {label && <p style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{label}</p>}
      <p style={{ fontFamily: "'Kaisei Decol',serif", color: payload[0]?.color || GREEN, fontSize: 14 }}>
        {payload[0]?.name ? `${payload[0].name}: ` : ''}{payload[0]?.value}
      </p>
    </div>
  );
}

/* ── pie custom label ── */
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ── stat card ── */
function StatCard({ label, sublabel, value, sub }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl px-5"
      style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
      <div>
        <p style={{ fontFamily: "'Hahmlet',sans-serif", color: GREEN, fontSize: 12, fontWeight: 700 }}>{label}</p>
        {sublabel && <p style={{ fontFamily: "'Hahmlet',sans-serif", color: GREEN, fontSize: 12, fontWeight: 700 }}>{sublabel}</p>}
      </div>
      <div className="text-right">
        <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 34, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 10, marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── chart card wrapper ── */
function ChartCard({ title, children, span2 }) {
  return (
    <div className={`bg-white rounded-3xl p-5 no-print ${span2 ? 'lg:col-span-2' : ''}`}
      style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
      <p className="mb-4" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 15 }}>{title}</p>
      {children}
    </div>
  );
}

/* ── CSV export ── */
function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape  = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s; };
  const csv     = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function CaptainReports() {
  const [requests,      setRequests]      = useState([]);
  const [residentStats, setResidentStats] = useState({ total: 0, pending: 0 });
  const [purokStats,    setPurokStats]    = useState([]);
  const [loading,       setLoading]       = useState(true);

  /* filters */
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');
  const [docType,  setDocType]  = useState('All');
  const [status,   setStatus]   = useState('All');

  useEffect(() => {
    Promise.all([getRequests(), getVerificationStats(), getPurokStats()])
      .then(([rq, rs, ps]) => { setRequests(rq.data); setResidentStats(rs.data); setPurokStats(ps.data); })
      .finally(() => setLoading(false));
  }, []);

  /* ── derived ── */
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const paidRequests     = requests.filter((r) => r.paymentStatus === 'paid');
  const totalCollections = paidRequests.reduce((s, r) => s + (r.amountPaid || 0), 0);
  const clearancesMonth  = requests.filter((r) =>
    r.documentType === 'Barangay Clearance' && r.status?.toLowerCase() === 'completed' && new Date(r.updatedAt) >= monthStart
  ).length;

  /* filtered table rows */
  const filtered = requests.filter((r) => {
    const d = new Date(r.createdAt);
    if (fromDate && d < new Date(fromDate)) return false;
    if (toDate   && d > new Date(toDate + 'T23:59:59')) return false;
    if (docType !== 'All' && r.documentType !== docType) return false;
    if (status  !== 'All' && r.status !== status) return false;
    return true;
  });

  /* ── chart data ── */

  /* 1. Pie — requests by document type */
  const byTypePie = [
    { name: 'Clearance',    value: requests.filter((r) => r.documentType === 'Barangay Clearance').length },
    { name: 'Residency',    value: requests.filter((r) => r.documentType === 'Certificate of Residency').length },
    { name: 'Indigency',    value: requests.filter((r) => r.documentType === 'Certificate of Indigency').length },
  ].filter((d) => d.value > 0);

  /* 2. Horizontal bar — requests by status */
  const byStatusBar = ['Pending','Processing','Printing','Completed','Rejected'].map((s) => ({
    name: s, count: requests.filter((r) => r.status === s).length,
    fill: STATUS_COLORS[s],
  }));

  /* 3. Area — monthly trend last 6 months */
  const monthlyArea = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      return {
        name:       d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        requests:   requests.filter((r) => { const t = new Date(r.createdAt); return t >= d && t < next; }).length,
        completed:  requests.filter((r) => { const t = new Date(r.createdAt); return t >= d && t < next && r.status === 'Completed'; }).length,
      };
    });
  })();

  /* 4. Radial bar — payment breakdown */
  const paymentRadial = [
    { name: 'Paid',   value: paidRequests.length,                                              fill: GREEN     },
    { name: 'Unpaid', value: requests.filter((r) => r.paymentStatus !== 'paid').length,        fill: '#F59E0B' },
  ];

  /* 5. Line — collections per month */
  const collectionsLine = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const amount = paidRequests
        .filter((r) => { const t = new Date(r.updatedAt); return t >= d && t < next; })
        .reduce((s, r) => s + (r.amountPaid || 0), 0);
      return { name: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), amount };
    });
  })();

  const DOC_TYPES = ['All', 'Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency'];
  const STATUSES  = ['All', 'Pending', 'Processing', 'Printing', 'Completed', 'Rejected'];

  return (
    <CaptainLayout title="REPORTS">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-4">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
          <StatCard label="TOTAL"      sublabel="REQUESTS"    value={requests.length} />
          <StatCard label="TOTAL"      sublabel="RESIDENTS"   value={residentStats.total} />
          <StatCard label="TOTAL"      sublabel="COLLECTIONS" value={`₱${totalCollections.toLocaleString()}`} />
          <StatCard label="CLEARANCES" sublabel="THIS MONTH"  value={clearancesMonth} />
        </div>

        {/* ── Row 1: Pie + Horizontal Bar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Pie — by document type */}
          <ChartCard title="Requests by Document Type">
            {byTypePie.length === 0
              ? <p className="text-center py-10 text-sm" style={{ color: '#C0B0B0' }}>No data</p>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byTypePie} cx="50%" cy="50%" outerRadius={85}
                      dataKey="value" labelLine={false} label={<PieLabel />}>
                      {byTypePie.map((_, i) => <Cell key={i} fill={DOC_COLORS[i % DOC_COLORS.length]} />)}
                    </Pie>
                    <Legend
                      iconType="circle" iconSize={8}
                      formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>}
                    />
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </ChartCard>

          {/* Horizontal bar — by status */}
          <ChartCard title="Requests by Status">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStatusBar} layout="vertical" barSize={18}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#F0EAEA" />
                <XAxis type="number" allowDecimals={false}
                  tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={72}
                  tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#555' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9F7F7' }} />
                <Bar dataKey="count" radius={[0,6,6,0]}>
                  {byStatusBar.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Row 2: Area trend (full width) ── */}
        <ChartCard title="Monthly Request Trend — last 6 months">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={monthlyArea} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GREEN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradComp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4CAF50" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4CAF50" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#F0EAEA" />
              <XAxis dataKey="name"
                tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }}
                axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false}
                tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }}
                axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
              <Area type="monotone" dataKey="requests"  name="Total Requests"
                stroke={GREEN}     fill="url(#gradReq)"  strokeWidth={2} dot={{ r: 3, fill: GREEN }} />
              <Area type="monotone" dataKey="completed" name="Completed"
                stroke="#4CAF50"   fill="url(#gradComp)" strokeWidth={2} dot={{ r: 3, fill: '#4CAF50' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Row 3: Line collections + Radial payment ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Line — monthly collections */}
          <ChartCard title="Monthly Collections (₱)">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={collectionsLine} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F0EAEA" />
                <XAxis dataKey="name"
                  tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }}
                  axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₱${v}`}
                  tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }}
                  axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  formatter={(v) => [`₱${v.toLocaleString()}`, 'Collections']}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="amount" stroke={GREEN} strokeWidth={2.5}
                  dot={{ r: 4, fill: GREEN, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: GREEN }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Radial bar — paid vs unpaid */}
          <ChartCard title="Payment Status Breakdown">
            {requests.length === 0
              ? <p className="text-center py-10 text-sm" style={{ color: '#C0B0B0' }}>No data</p>
              : (
                <ResponsiveContainer width="100%" height={210}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%"
                    data={paymentRadial} startAngle={180} endAngle={-180}>
                    <RadialBar dataKey="value" cornerRadius={6} label={false} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                    <Tooltip
                      formatter={(v, n) => [v, n]}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
          </ChartCard>
        </div>

        {/* ── Row 4: Purok bar chart ── */}
        <ChartCard title="Residents per Purok">
          {purokStats.length === 0
            ? <p className="text-center py-6 text-sm" style={{ color: '#C0B0B0' }}>No data</p>
            : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={purokStats} barSize={32} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F0EAEA" />
                  <XAxis dataKey="purok"
                    tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }}
                    axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false}
                    tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }}
                    axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
                  <Bar dataKey="count" radius={[6,6,0,0]}>
                    {purokStats.map((_, i) => <Cell key={i} fill={PUROK_COLORS[i % PUROK_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        {/* ── Generate Report ── */}
        <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 15 }}>Generate Report</p>
            <div className="flex gap-2 no-print">
              <button onClick={() => {
                  const rows = filtered.map((r) => ({
                    'Full Name':     r.profile?.fullName || r.user?.username || '—',
                    'Document Type': r.documentType,
                    'Status':        r.status,
                    'Payment':       r.paymentStatus,
                    'Amount':        r.amountPaid || 0,
                    'Purpose':       r.purpose || '—',
                    'Date':          new Date(r.createdAt).toLocaleDateString('en-PH'),
                  }));
                  exportCSV(rows, `report_${new Date().toISOString().slice(0,10)}.csv`);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ fontFamily: "'Hahmlet',sans-serif", background: '#F0FDF4', color: GREEN, border: `1px solid #BBF7D0` }}>
                <FiDownload size={14} /> Export CSV
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ fontFamily: "'Hahmlet',sans-serif", background: GREEN }}>
                <FiPrinter size={14} /> Print / PDF
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 no-print">
            {[['From', 'date', fromDate, setFromDate], ['To', 'date', toDate, setToDate]].map(([lbl, type, val, set]) => (
              <div key={lbl}>
                <label style={{ fontFamily: "'Kaisei Decol',serif", color: '#827575', fontSize: 12, display: 'block', marginBottom: 4 }}>{lbl}</label>
                <input type={type} value={val} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ fontFamily: "'Hanken Grotesk',sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }} />
              </div>
            ))}
            {[['Document Type', DOC_TYPES, docType, setDocType], ['Status', STATUSES, status, setStatus]].map(([lbl, opts, val, set]) => (
              <div key={lbl}>
                <label style={{ fontFamily: "'Kaisei Decol',serif", color: '#827575', fontSize: 12, display: 'block', marginBottom: 4 }}>{lbl}</label>
                <select value={val} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ fontFamily: "'Hanken Grotesk',sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}>
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Printable table */}
          <div id="print-area">
            {/* print header */}
            <div style={{ display: 'none' }} className="print:block">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${GREEN}` }}>
                <img src={assets.DOLOGONLOGO} alt="logo" style={{ width: 52, height: 52, borderRadius: '50%' }} />
                <div>
                  <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 18, fontWeight: 700 }}>Barangay Dologon — Document Report</p>
                  <p style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#555', fontSize: 11 }}>
                    Generated {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {(fromDate || toDate) ? ` · Period: ${fromDate || '—'} to ${toDate || '—'}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <p className="mb-3" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 14 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              {docType !== 'All' ? ` · ${docType}` : ''}
              {status  !== 'All' ? ` · ${status}`  : ''}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 560, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F0FDF4', borderBottom: `2px solid ${GREEN}` }}>
                    {['#','Name','Document Type','Status','Payment','Amount','Date'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left"
                        style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontWeight: 400, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} className="py-8 text-center" style={{ color: '#C0B0B0' }}>Loading…</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center" style={{ color: '#C0B0B0' }}>No records match the filter</td></tr>}
                  {!loading && filtered.map((r, i) => (
                    <tr key={r._id} style={{ borderBottom: '1px solid #FAF7F7' }} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5" style={{ color: '#C0B0B0', fontFamily: "'Hanken Grotesk',sans-serif" }}>{i + 1}</td>
                      <td className="px-4 py-2.5" style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#333', fontWeight: 600 }}>
                        {r.profile?.fullName || r.user?.username || '—'}
                      </td>
                      <td className="px-4 py-2.5" style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#A18D8D' }}>{r.documentType}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: (STATUS_COLORS[r.status] || '#888') + '22', color: STATUS_COLORS[r.status] || '#888', fontFamily: "'Hanken Grotesk',sans-serif" }}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: r.paymentStatus === 'paid' ? GREEN : '#F59E0B', fontSize: 11 }}>
                        {r.paymentStatus}
                      </td>
                      <td className="px-4 py-2.5" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN }}>
                        {r.amountPaid ? `₱${r.amountPaid.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2.5" style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#A18D8D' }}>
                        {new Date(r.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {!loading && filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${GREEN}`, background: '#F9F7F7' }}>
                      <td colSpan={5} className="px-4 py-2"
                        style={{ fontFamily: "'Hahmlet',sans-serif", color: GREEN, fontSize: 12, fontWeight: 700 }}>TOTAL COLLECTIONS</td>
                      <td className="px-4 py-2" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 16 }}>
                        ₱{filtered.filter((r) => r.paymentStatus === 'paid').reduce((s, r) => s + (r.amountPaid || 0), 0).toLocaleString()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </CaptainLayout>
  );
}
