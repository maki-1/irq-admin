/* Shared building blocks for the admin report pages (Captain + Collector). */
import { FiDownload, FiPrinter } from 'react-icons/fi';
import assets from '../../assets/cloudinaryAssets';
import useAuthStore from '../../store/authStore';
import { exportReportXLSX } from '../../utils/reportExport';

/* ── palette ── */
export const GREEN = '#156D07';

export const SERIES = ['#156D07', '#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7'];

export const STATUS_COLORS = {
  Pending:    '#F59E0B',
  Processing: '#3B82F6',
  Printing:   '#8B5CF6',
  Ready:      '#0EA5E9',
  Completed:  '#156D07',
  Claimed:    '#0F5132',
  Rejected:   '#EF4444',
};

export const DOC_TYPES = ['All', 'Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency'];
export const STATUSES  = ['All', 'Pending', 'Processing', 'Printing', 'Ready', 'Completed', 'Claimed', 'Rejected'];

/* ── helpers ── */
export function within(date, from, to) {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to   && t > new Date(to + 'T23:59:59').getTime()) return false;
  return true;
}

export function lastMonths(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { key: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), start: d, end: next };
  });
}

export const money  = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const money0 = (n) => `₱${Math.round(Number(n || 0)).toLocaleString('en-PH')}`;
export const num    = (v) => Number(v || 0);
export const dayKey = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const isClaimed = (s) => /claim|complete/i.test(String(s || ''));
export const docClass  = (t) =>
  t === 'Barangay Clearance' ? 'Clearance'
  : /^Certificate/i.test(String(t || '')) ? 'Certificate'
  : 'Other';

/* Income category for a paid document request. */
export const incomeCategory = (t) =>
  t === 'Barangay Clearance' ? 'Barangay Clearance Fees'
  : t === 'Certificate of Residency' ? 'Certificate of Residency'
  : t === 'Certificate of Indigency' ? 'Certificate of Indigency'
  : /^Certificate/i.test(String(t || '')) ? 'Other Certifications'
  : 'Other Document Fees';

/* ── print stylesheet (isolates #print-area on window.print) ── */
export function PrintStyle() {
  return (
    <style>{`
      @media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; inset: 0; padding: 24px; }
        .no-print { display: none !important; }
      }
    `}</style>
  );
}

/* ── recharts shared tooltip ── */
export function ChartTooltip({ active, payload, label, money: asMoney }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      {label && <p style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ fontFamily: "'Kaisei Decol',serif", color: p.color || GREEN, fontSize: 14 }}>
          {p.name ? `${p.name}: ` : ''}{asMoney ? money0(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ── pie slice label ── */
export function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ── KPI card ── */
export function StatCard({ label, sublabel, value, sub }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl px-5"
      style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
      <div>
        <p style={{ fontFamily: "'Hahmlet',sans-serif", color: GREEN, fontSize: 12, fontWeight: 700 }}>{label}</p>
        {sublabel && <p style={{ fontFamily: "'Hahmlet',sans-serif", color: GREEN, fontSize: 12, fontWeight: 700 }}>{sublabel}</p>}
      </div>
      <div className="text-right">
        <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 26, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 10, marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── chart wrapper (hidden on print) ── */
export function ChartCard({ title, children, span2 }) {
  return (
    <div className={`bg-white rounded-3xl p-5 no-print ${span2 ? 'lg:col-span-2' : ''}`}
      style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
      <p className="mb-4" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 15 }}>{title}</p>
      {children}
    </div>
  );
}

export function NoData() {
  return <p className="text-center py-10 text-sm" style={{ color: '#C0B0B0' }}>No data</p>;
}

/* ── Excel export (object rows → presentable .xlsx with letterhead) ── */
export function exportRowsXLSX(rows, filename, user, title) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const body = rows.map((r) => columns.map((h) => r[h] ?? ''));
  return exportReportXLSX({
    title: title || 'Report',
    sheetName: 'Report',
    columns,
    rows: body,
    user,
    filename: String(filename).replace(/\.(csv|xlsx)$/i, ''),
  });
}

/* ── print-only report header (logo + generated stamp + generated-by) ── */
export function PrintHeader({ title, subtitle }) {
  const { user } = useAuthStore();
  const who = user?.fullName
    ? `${user.fullName}${user.role ? ` (${user.role})` : ''}`
    : 'Unknown';
  return (
    <div style={{ display: 'none' }} className="print:block">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${GREEN}` }}>
        <img src={assets.DOLOGONLOGO} alt="logo" style={{ width: 52, height: 52, borderRadius: '50%' }} />
        <div>
          <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 18, fontWeight: 700 }}>
            Barangay Dologon — {title}
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#555', fontSize: 11 }}>
            iRequestDologon System · Generated {new Date().toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#888', fontSize: 10 }}>
            Generated by: {who}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── toolbar: Export Excel + Print ── */
export function ReportToolbar({ csvRows, csvName, title }) {
  const { user } = useAuthStore();
  return (
    <div className="flex gap-2 no-print">
      <button onClick={() => exportRowsXLSX(csvRows, csvName, user, title)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
        style={{ fontFamily: "'Hahmlet',sans-serif", background: '#F0FDF4', color: GREEN, border: '1px solid #BBF7D0' }}>
        <FiDownload size={14} /> Export Excel
      </button>
      <button onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
        style={{ fontFamily: "'Hahmlet',sans-serif", background: GREEN }}>
        <FiPrinter size={14} /> Print / PDF
      </button>
    </div>
  );
}

/* ── printable / exportable table card ── */
export function ReportTable({ title, subtitle, columns, rows, csvRows, csvName, footer, align }) {
  return (
    <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 15 }}>{title}</p>
        <ReportToolbar csvRows={csvRows} csvName={csvName} title={title} />
      </div>

      <div id="print-area">
        <PrintHeader title={title} subtitle={subtitle} />

        {subtitle && (
          <p className="mb-3" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 14 }}>{subtitle}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 560, fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F0FDF4', borderBottom: `2px solid ${GREEN}` }}>
                {columns.map((c, j) => (
                  <th key={c} className="px-4 py-2"
                    style={{ textAlign: align?.[j] || 'left', fontFamily: "'Kaisei Decol',serif", color: GREEN, fontWeight: 400, fontSize: 12 }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={columns.length} className="py-8 text-center" style={{ color: '#C0B0B0' }}>No records</td></tr>
              )}
              {rows.map((cells, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #FAF7F7' }} className="hover:bg-gray-50 transition-colors">
                  {cells.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5"
                      style={{ textAlign: align?.[j] || 'left', fontFamily: "'Hanken Grotesk',sans-serif", color: j === 0 ? '#333' : '#666', fontWeight: j === 0 ? 600 : 400 }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot>
                <tr style={{ borderTop: `2px solid ${GREEN}`, background: '#F9F7F7' }}>
                  {footer.map((cell, j) => (
                    <td key={j} className="px-4 py-2"
                      style={{ textAlign: align?.[j] || 'left', fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: j === 0 ? 12 : 15, fontWeight: 700 }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
