import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import { FiDownload } from 'react-icons/fi';
import { getRequests, getReleases } from '../../services/request.service';
import { getVerificationStats, getPurokStats } from '../../services/verification.service';
import { getAuditLogs } from '../../services/audit.service';
import CaptainLayout from '../../components/layouts/CaptainLayout';
import useAuthStore from '../../store/authStore';
import FinancialReport from '../../components/reports/FinancialReport';
import {
  GREEN, SERIES, STATUS_COLORS, DOC_TYPES, STATUSES,
  within, lastMonths, money, num, dayKey, isClaimed, docClass,
  ChartTooltip, PieLabel, StatCard, ChartCard, NoData, ReportTable, PrintStyle, exportRowsXLSX,
} from '../../components/reports/reportKit';

/* ── report tabs ── */
const TABS = [
  { key: 'requests',    label: 'Document Requests' },
  { key: 'financial',   label: 'Financial' },
  { key: 'utilization', label: 'Service Utilization' },
  { key: 'issuance',    label: 'Clearance / Certificate Issuance' },
];

// Purok revenue is the fixed clearance share, not the document's full price.
const PUROK_CLEARANCE_REVENUE_PER_DOCUMENT = 50;

/* ════════════════════════════════════════════════════════════════════
   1. DOCUMENT REQUEST REPORTS
   ════════════════════════════════════════════════════════════════════ */
function DocumentRequestReport({ requests, from, to, docType, status }) {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [selectedPurok, setSelectedPurok] = useState(null);
  const reqs = requests.filter((r) =>
    within(r.createdAt, from, to) &&
    (docType === 'All' || r.documentType === docType) &&
    (status  === 'All' || r.status === status));

  // A filter change should always show the first matching records instead of
  // leaving the report on a page that may no longer exist.
  useEffect(() => { setPage(1); }, [from, to, docType, status]);
  useEffect(() => { setSelectedPurok(null); }, [from, to, docType, status]);

  const completed = reqs.filter((r) => ['Ready for Pickup', 'Claimed'].includes(r.status));
  const avgDays = completed.length
    ? (completed.reduce((s, r) => s + (new Date(r.updatedAt) - new Date(r.createdAt)), 0)
        / completed.length / 86_400_000).toFixed(1)
    : '—';

  const byType = DOC_TYPES.slice(1)
    .map((t) => ({ name: t.replace('Certificate of ', 'Cert. '), value: reqs.filter((r) => r.documentType === t).length }))
    .filter((d) => d.value > 0);

  const byStatus = STATUSES.slice(1).map((s) => ({
    name: s, count: reqs.filter((r) => r.status === s).length, fill: STATUS_COLORS[s] || '#888',
  })).filter((d) => d.count > 0);

  const trend = lastMonths(6).map((m) => ({
    name:      m.key,
    requests:  requests.filter((r) => { const t = new Date(r.createdAt); return t >= m.start && t < m.end; }).length,
    completed: requests.filter((r) => { const t = new Date(r.createdAt); return t >= m.start && t < m.end && ['Ready for Pickup', 'Claimed'].includes(r.status); }).length,
  }));

  const paidRequests = reqs.filter((r) =>
    ['Ready for Pickup', 'Claimed'].includes(r.status) && String(r.paymentStatus).toLowerCase() === 'paid'
  );
  const purokRevenueFor = () => PUROK_CLEARANCE_REVENUE_PER_DOCUMENT;
  const purokFor = (r) => r.profile?.purok || r.profile?.address?.split(',')[0]?.trim() || 'Unassigned Purok';
  const paymentChannelFor = (r) => {
    const provider = r.payments?.find((p) => String(p.status).toLowerCase() === 'paid')?.provider?.toLowerCase();
    return r.channel === 'kiosk' || provider === 'manual' ? 'Walk-in Payment' : 'Online Payment';
  };
  const byPurokRevenue = Object.entries(
    paidRequests.reduce((acc, r) => {
      const purok = purokFor(r);
      acc[purok] = (acc[purok] || 0) + purokRevenueFor(r);
      return acc;
    }, {}),
  ).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const paymentBreakdown = selectedPurok
    ? ['Walk-in Payment', 'Online Payment'].map((name) => ({
        name,
        amount: paidRequests
          .filter((r) => purokFor(r) === selectedPurok && paymentChannelFor(r) === name)
          .reduce((sum, r) => sum + purokRevenueFor(r), 0),
      })).filter((entry) => entry.amount > 0)
    : [];
  const revenueExportRows = byPurokRevenue.map(({ name, amount }) => {
    const purokRequests = paidRequests.filter((r) => purokFor(r) === name);
    const kiosk = purokRequests
      .filter((r) => paymentChannelFor(r) === 'Walk-in Payment')
      .reduce((sum, r) => sum + purokRevenueFor(r), 0);
    const paymongo = purokRequests
      .filter((r) => paymentChannelFor(r) === 'Online Payment')
      .reduce((sum, r) => sum + purokRevenueFor(r), 0);
    return {
      Purok: name,
      'Paid Documents': purokRequests.length,
      'Purok Clearance Revenue (₱)': amount.toFixed(2),
      'Walk-in Payment (₱)': kiosk.toFixed(2),
      'Online Payment (₱)': paymongo.toFixed(2),
    };
  });

  const exportPurokRevenue = () => exportRowsXLSX(
    revenueExportRows,
    `revenue-by-purok_${new Date().toISOString().slice(0, 10)}.xlsx`,
    user,
    'Purok Clearance Revenue per Purok',
  );

  const csvRows = reqs.map((r) => ({
    Name:     r.profile?.fullName || r.user?.username || '—',
    Type:     r.documentType,
    Purpose:  r.purpose || '—',
    Status:   r.status,
    Payment:  r.paymentStatus,
    Date:     new Date(r.createdAt).toLocaleDateString('en-PH'),
  }));
  const tableRows = reqs.map((r) => ([
    r.profile?.fullName || r.user?.username || '—',
    r.documentType,
    r.purpose || '—',
    r.status,
    r.paymentStatus,
    new Date(r.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
  ]));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <StatCard label="TOTAL"      sublabel="REQUESTS"   value={reqs.length} />
        <StatCard label="PENDING"    sublabel="+ PROCESSING" value={reqs.filter((r) => ['Pending', 'Processing', 'Printing'].includes(r.status)).length} />
        <StatCard label="READY / CLAIMED"  sublabel="Prepared documents"  value={completed.length} />
        <StatCard label="AVG"        sublabel="TURNAROUND" value={avgDays} sub="days to complete" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Requests by Document Type">
          {byType.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byType} cx="50%" cy="50%" outerRadius={85} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {byType.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Requests by Status">
          {byStatus.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStatus} layout="vertical" barSize={16} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#F0EAEA" />
                <XAxis type="number" allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={78} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9F7F7' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {byStatus.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Monthly Request Trend — last 6 months">
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gComp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.2} /><stop offset="95%" stopColor="#4CAF50" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F0EAEA" />
            <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
            <Area type="monotone" dataKey="requests"  name="Total Requests" stroke={GREEN}   fill="url(#gReq)"  strokeWidth={2} dot={{ r: 3, fill: GREEN }} />
            <Area type="monotone" dataKey="completed" name="Ready / Claimed"      stroke="#4CAF50" fill="url(#gComp)" strokeWidth={2} dot={{ r: 3, fill: '#4CAF50' }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Purok Clearance Revenue per Purok (₱)"
        action={
          <button type="button" onClick={exportPurokRevenue} disabled={revenueExportRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
            style={{ color: GREEN, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <FiDownload size={13} /> Export Excel
          </button>
        }>
        {byPurokRevenue.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byPurokRevenue} barSize={40} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#F0EAEA" />
              <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₱${v}`} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} cursor="pointer"
                onClick={(entry) => setSelectedPurok(entry?.name || entry?.payload?.name || null)}>
                {byPurokRevenue.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {byPurokRevenue.length > 0 && <p className="mt-2 text-center text-xs" style={{ color: '#827575' }}>₱50 per paid, completed document · Select a purok bar to view its payment-channel totals.</p>}
      </ChartCard>

      {selectedPurok && (
        <ChartCard title={`Payment Channels — ${selectedPurok} (₱)`}>
          {paymentBreakdown.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={paymentBreakdown} barSize={44} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F0EAEA" />
                <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₱${v}`} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {paymentBreakdown.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      <ReportTable
        title="Document Request Report"
        subtitle={`${reqs.length} record${reqs.length !== 1 ? 's' : ''}${docType !== 'All' ? ` · ${docType}` : ''}${status !== 'All' ? ` · ${status}` : ''}`}
        columns={['Name', 'Document Type', 'Purpose', 'Status', 'Payment', 'Date']}
        rows={visibleRows}
        csvRows={csvRows}
        csvName={`document-requests_${new Date().toISOString().slice(0, 10)}.csv`}
      />
      {tableRows.length > pageSize && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-1 no-print">
          <p style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#827575', fontSize: 12 }}>
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, tableRows.length)} of {tableRows.length} requests
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
              style={{ color: GREEN, background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
              <button
                type="button"
                key={number}
                onClick={() => setPage(number)}
                className="w-8 h-8 rounded-lg text-xs"
                style={{ color: number === safePage ? '#FFFFFF' : GREEN, background: number === safePage ? GREEN : '#F0FDF4', border: `1px solid ${number === safePage ? GREEN : '#BBF7D0'}` }}
              >{number}</button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
              style={{ color: GREEN, background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   3. BARANGAY ACTIVITY REPORTS
   ════════════════════════════════════════════════════════════════════ */
function ActivityReport({ audit, requests, releases, residentStats, from, to }) {
  const logs = audit.filter((l) => within(l.createdAt, from, to));
  const reqsFiled = requests.filter((r) => within(r.createdAt, from, to)).length;
  const released  = releases.filter((r) => within(r.completedAt || r.createdAt, from, to)).length;
  const staff     = new Set(logs.map((l) => l.admin?.fullName).filter(Boolean));

  const byAction = Object.entries(
    logs.reduce((acc, l) => { const k = l.action || 'Other'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  const byRole = Object.entries(
    logs.reduce((acc, l) => { const k = l.admin?.role || 'Unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  ).map(([name, value]) => ({ name, value }));

  const perDay = (() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i));
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return {
        name: dayKey(d),
        actions: audit.filter((l) => { const t = new Date(l.createdAt); return t >= d && t < next; }).length,
      };
    });
  })();

  const detailText = (d) => {
    if (d == null) return '—';
    if (typeof d === 'string') return d;
    try { return JSON.stringify(d); } catch { return String(d); }
  };

  const csvRows = logs.map((l) => ({
    Date:   new Date(l.createdAt).toLocaleString('en-PH'),
    Staff:  l.admin?.fullName || '—',
    Role:   l.admin?.role || '—',
    Action: l.action || '—',
    Details: detailText(l.details),
  }));
  const tableRows = logs.slice(0, 200).map((l) => ([
    new Date(l.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    l.admin?.fullName || '—',
    l.admin?.role || '—',
    l.action || '—',
    detailText(l.details),
  ]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <StatCard label="ADMIN"    sublabel="ACTIONS"    value={logs.length} />
        <StatCard label="REQUESTS" sublabel="FILED"      value={reqsFiled} />
        <StatCard label="DOCUMENTS" sublabel="RELEASED"  value={released} />
        <StatCard label="ACTIVE"   sublabel="STAFF"      value={staff.size} sub={`${residentStats.total} residents on file`} />
      </div>

      <ChartCard title="Daily Admin Activity — last 14 days">
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={perDay} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F0EAEA" />
            <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="actions" name="Actions" stroke={GREEN} fill="url(#gAct)" strokeWidth={2} dot={{ r: 3, fill: GREEN }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Actions by Type">
          {byAction.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byAction} layout="vertical" barSize={16} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#F0EAEA" />
                <XAxis type="number" allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9F7F7' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {byAction.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Actions by Staff Role">
          {byRole.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byRole} cx="50%" cy="50%" outerRadius={85} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {byRole.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ReportTable
        title="Barangay Activity Report"
        subtitle={`${logs.length} logged action${logs.length !== 1 ? 's' : ''}${logs.length > 200 ? ' · showing latest 200' : ''}`}
        columns={['Date', 'Staff', 'Role', 'Action', 'Details']}
        rows={tableRows}
        csvRows={csvRows}
        csvName={`barangay-activity_${new Date().toISOString().slice(0, 10)}.csv`}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   4. SERVICE UTILIZATION REPORTS
   ════════════════════════════════════════════════════════════════════ */
function UtilizationReport({ requests, purokStats, from, to }) {
  const reqs = requests.filter((r) => within(r.createdAt, from, to));

  const perUser = reqs.reduce((acc, r) => { acc[r.userId] = (acc[r.userId] || 0) + 1; return acc; }, {});
  const uniqueUsers  = Object.keys(perUser).length;
  const repeatUsers  = Object.values(perUser).filter((n) => n > 1).length;
  const perResident  = uniqueUsers ? (reqs.length / uniqueUsers).toFixed(1) : '—';

  const typeStats = DOC_TYPES.slice(1).map((t) => {
    const rows  = reqs.filter((r) => r.documentType === t);
    const done  = rows.filter((r) => ['Ready for Pickup', 'Claimed'].includes(r.status)).length;
    const users = new Set(rows.map((r) => r.userId)).size;
    const amt   = rows.reduce((s, r) => s + num(r.amountPaid), 0);
    return {
      type: t,
      requests: rows.length,
      users,
      done,
      rate: rows.length ? Math.round((done / rows.length) * 100) : 0,
      avg: rows.length ? Math.round(amt / rows.length) : 0,
    };
  });

  const topType = [...typeStats].sort((a, b) => b.requests - a.requests)[0];

  const demand = typeStats.filter((s) => s.requests > 0)
    .map((s) => ({ name: s.type.replace('Certificate of ', 'Cert. '), requests: s.requests, residents: s.users }));

  const delivery = Object.entries(
    reqs.reduce((acc, r) => { const k = r.deliveryMethod || 'Unspecified'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  ).map(([name, value]) => ({ name, value }));

  const uniqueMonthly = lastMonths(6).map((m) => ({
    name: m.key,
    residents: new Set(
      requests.filter((r) => { const t = new Date(r.createdAt); return t >= m.start && t < m.end; }).map((r) => r.userId),
    ).size,
  }));

  const csvRows = typeStats.map((s) => ({
    Service: s.type, Requests: s.requests, Unique_Residents: s.users,
    Ready_or_Claimed: s.done, Completion_Rate: `${s.rate}%`, Avg_Fee: s.avg,
  }));
  const tableRows = typeStats.map((s) => ([
    s.type, s.requests, s.users, s.done, `${s.rate}%`, money(s.avg),
  ]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <StatCard label="RESIDENTS" sublabel="SERVED"        value={uniqueUsers} />
        <StatCard label="REQUESTS"  sublabel="PER RESIDENT"  value={perResident} />
        <StatCard label="REPEAT"    sublabel="REQUESTERS"    value={repeatUsers} />
        <StatCard label="TOP"       sublabel="SERVICE"       value={topType?.requests || 0} sub={topType?.type} />
      </div>

      <ChartCard title="Service Demand by Document Type">
        {demand.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={demand} barSize={26} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#F0EAEA" />
              <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="requests"  name="Requests"          fill={GREEN}   radius={[6, 6, 0, 0]} />
              <Bar dataKey="residents" name="Unique Residents"  fill="#81C784" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Delivery Method Preference">
          {delivery.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={delivery} cx="50%" cy="50%" outerRadius={85} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {delivery.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Unique Requesters per Month">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={uniqueMonthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#F0EAEA" />
              <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="residents" name="Residents" stroke={GREEN} strokeWidth={2.5} dot={{ r: 4, fill: GREEN }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Resident Base per Purok">
        {purokStats.length === 0 ? <NoData /> : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={purokStats} barSize={32} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#F0EAEA" />
              <XAxis dataKey="purok" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {purokStats.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ReportTable
        title="Service Utilization Report"
        subtitle={`${uniqueUsers} resident${uniqueUsers !== 1 ? 's' : ''} served · ${reqs.length} total requests`}
        columns={['Service', 'Requests', 'Unique Residents', 'Ready / Claimed', 'Completion Rate', 'Avg Fee']}
        rows={tableRows}
        csvRows={csvRows}
        csvName={`service-utilization_${new Date().toISOString().slice(0, 10)}.csv`}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   5. CLEARANCE / CERTIFICATE ISSUANCE REPORTS
   ════════════════════════════════════════════════════════════════════ */
function IssuanceReport({ releases, from, to }) {
  const rel = releases.filter((r) => within(r.completedAt || r.createdAt, from, to));

  const clearances   = rel.filter((r) => docClass(r.documentType) === 'Clearance').length;
  const certificates = rel.filter((r) => docClass(r.documentType) === 'Certificate').length;
  const claimed      = rel.filter((r) => isClaimed(r.claimStatus)).length;
  const awaiting     = rel.length - claimed;

  const byType = Object.entries(
    rel.reduce((acc, r) => { const k = r.documentType || 'Unspecified'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  ).map(([name, value]) => ({ name: name.replace('Certificate of ', 'Cert. '), value }));

  const monthly = lastMonths(6).map((m) => ({
    name: m.key,
    issued: releases.filter((r) => { const t = new Date(r.completedAt || r.createdAt); return t >= m.start && t < m.end; }).length,
  }));

  const claimRadial = [
    { name: 'Claimed',  value: claimed,  fill: GREEN },
    { name: 'Waiting for Pickup', value: awaiting, fill: '#F59E0B' },
  ].filter((d) => d.value > 0);

  const byPurok = Object.entries(
    rel.reduce((acc, r) => { const k = r.purok || 'Unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const csvRows = rel.map((r) => ({
    Name:    r.fullName || r.user?.username || '—',
    Type:    r.documentType || '—',
    Purpose: r.purpose || '—',
    Purok:   r.purok || '—',
    Claim:   isClaimed(r.claimStatus) ? 'Claimed' : 'Waiting for Pickup',
    Issued:  r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-PH') : '—',
  }));
  const tableRows = rel.map((r) => ([
    r.fullName || r.user?.username || '—',
    r.documentType || '—',
    r.purpose || '—',
    r.purok || '—',
    isClaimed(r.claimStatus) ? 'Claimed' : 'Waiting for Pickup',
    r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
  ]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <StatCard label="TOTAL"        sublabel="ISSUED"    value={rel.length} />
        <StatCard label="CLEARANCES"   sublabel="ISSUED"    value={clearances} />
        <StatCard label="CERTIFICATES" sublabel="ISSUED"    value={certificates} />
        <StatCard label="WAITING FOR"  sublabel="PICKUP"    value={awaiting} sub={`${claimed} already claimed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Issuance by Document Type">
          {byType.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byType} cx="50%" cy="50%" outerRadius={85} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {byType.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Claimed vs Waiting for Pickup">
          {claimRadial.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={claimRadial} startAngle={180} endAngle={-180}>
                <RadialBar dataKey="value" cornerRadius={6} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Monthly Issuance — last 6 months">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={monthly} barSize={34} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#F0EAEA" />
            <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
            <Bar dataKey="issued" radius={[6, 6, 0, 0]}>
              {monthly.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {byPurok.length > 0 && (
        <ChartCard title="Issuance by Purok">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={byPurok} barSize={28} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#F0EAEA" />
              <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F0FDF4' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {byPurok.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ReportTable
        title="Clearance / Certificate Issuance Report"
        subtitle={`${rel.length} document${rel.length !== 1 ? 's' : ''} issued · ${claimed} claimed · ${awaiting} waiting for pickup`}
        columns={['Name', 'Document Type', 'Purpose', 'Purok', 'Claim Status', 'Date Issued']}
        rows={tableRows}
        csvRows={csvRows}
        csvName={`issuance-report_${new Date().toISOString().slice(0, 10)}.csv`}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════════════ */
export default function CaptainReports() {
  const [tab, setTab] = useState('requests');

  const [requests,      setRequests]      = useState([]);
  const [releases,      setReleases]      = useState([]);
  const [audit,         setAudit]         = useState([]);
  const [residentStats, setResidentStats] = useState({ total: 0, pending: 0 });
  const [purokStats,    setPurokStats]    = useState([]);
  const [loading,       setLoading]       = useState(true);

  /* shared filters */
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');
  const [docType,  setDocType]  = useState('All');
  const [status,   setStatus]   = useState('All');

  useEffect(() => {
    Promise.allSettled([
      getRequests(), getReleases(), getAuditLogs(), getVerificationStats(), getPurokStats(),
    ])
      .then(([rq, rl, au, rs, ps]) => {
        if (rq.status === 'fulfilled') setRequests(rq.value.data || []);
        if (rl.status === 'fulfilled') setReleases(rl.value.data || []);
        if (au.status === 'fulfilled') setAudit(au.value.data || []);
        if (rs.status === 'fulfilled') setResidentStats(rs.value.data || { total: 0, pending: 0 });
        if (ps.status === 'fulfilled') setPurokStats(ps.value.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const showDocFilters = tab === 'requests';

  return (
    <CaptainLayout title="REPORTS">
      <PrintStyle />

      <div className="flex flex-col gap-4">

        {/* ── Tab bar ── */}
        <div className="flex gap-2 flex-wrap no-print">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-xl text-sm transition-colors"
              style={{
                fontFamily: "'Kaisei Decol',serif",
                background: tab === t.key ? GREEN : '#FFFFFF',
                color:      tab === t.key ? '#FFFFFF' : '#827575',
                boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Shared filter bar ── */}
        <div className="bg-white rounded-3xl p-5 no-print" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div className={`grid grid-cols-2 ${showDocFilters ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-3`}>
            {[['From', fromDate, setFromDate], ['To', toDate, setToDate]].map(([lbl, val, set]) => (
              <div key={lbl}>
                <label style={{ fontFamily: "'Kaisei Decol',serif", color: '#827575', fontSize: 12, display: 'block', marginBottom: 4 }}>{lbl}</label>
                <input type="date" value={val} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ fontFamily: "'Hanken Grotesk',sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }} />
              </div>
            ))}
            {showDocFilters && [['Document Type', DOC_TYPES, docType, setDocType], ['Status', STATUSES, status, setStatus]].map(([lbl, opts, val, set]) => (
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
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="mt-3 text-xs" style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: GREEN }}>
              Clear date range
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center py-16" style={{ fontFamily: "'Kaisei Decol',serif", color: '#C0B0B0' }}>Loading report data…</p>
        ) : (
          <>
            {tab === 'requests'    && <DocumentRequestReport requests={requests} from={fromDate} to={toDate} docType={docType} status={status} />}
            {tab === 'financial'   && <FinancialReport       requests={requests} from={fromDate} to={toDate} />}
            {tab === 'utilization' && <UtilizationReport      requests={requests} purokStats={purokStats} from={fromDate} to={toDate} />}
            {tab === 'issuance'    && <IssuanceReport         releases={releases} from={fromDate} to={toDate} />}
          </>
        )}
      </div>
    </CaptainLayout>
  );
}
