/* Financial report — income tracking, cumulative barangay-fund position and a
   printable financial summary. Shared by the Captain Reports page and the
   Collector Reports page. Income = paid document requests (fees, clearances,
   certifications). The date range is read as the *date paid* (settlement). */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar, Cell,
} from 'recharts';
import {
  GREEN, SERIES, within, lastMonths, money, money0, num, incomeCategory,
  ChartTooltip, StatCard, ChartCard, NoData, PrintStyle, PrintHeader, ReportToolbar,
} from './reportKit';

const CATEGORIES = [
  'Barangay Clearance Fees',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Other Certifications',
  'Other Document Fees',
];

const settledAt = (r) => new Date(r.updatedAt || r.createdAt);

/* small bordered table used inside the printable summary */
function MiniTable({ caption, head, rows, foot, align = [] }) {
  return (
    <div className="mb-6">
      <p className="mb-2" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 13 }}>{caption}</p>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 420, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F0FDF4', borderBottom: `2px solid ${GREEN}` }}>
              {head.map((h, j) => (
                <th key={h} className="px-4 py-2"
                  style={{ textAlign: align[j] || 'left', fontFamily: "'Kaisei Decol',serif", color: GREEN, fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={head.length} className="py-6 text-center" style={{ color: '#C0B0B0' }}>No records</td></tr>
            )}
            {rows.map((cells, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #FAF7F7' }}>
                {cells.map((c, j) => (
                  <td key={j} className="px-4 py-2"
                    style={{ textAlign: align[j] || 'left', fontFamily: "'Hanken Grotesk',sans-serif", color: j === 0 ? '#333' : '#666', fontWeight: j === 0 ? 600 : 400 }}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {foot && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${GREEN}`, background: '#F9F7F7' }}>
                {foot.map((c, j) => (
                  <td key={j} className="px-4 py-2"
                    style={{ textAlign: align[j] || 'left', fontFamily: "'Kaisei Decol',serif", color: GREEN, fontWeight: 700, fontSize: j === 0 ? 12 : 14 }}>
                    {c}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function FinancialReport({ requests, from, to }) {
  const paidAll = requests.filter((r) => r.paymentStatus === 'paid');

  /* period slices (by date paid) */
  const paid   = paidAll.filter((r) => within(r.updatedAt || r.createdAt, from, to));
  const inCreated = requests.filter((r) => within(r.createdAt, from, to));
  const unpaid = inCreated.filter((r) => r.paymentStatus === 'unpaid');
  const free   = inCreated.filter((r) => r.paymentStatus === 'free');

  const periodTotal = paid.reduce((s, r) => s + num(r.amountPaid), 0);
  const fundBalance = paidAll.reduce((s, r) => s + num(r.amountPaid), 0);
  const priorTotal  = from
    ? paidAll.filter((r) => settledAt(r) < new Date(from)).reduce((s, r) => s + num(r.amountPaid), 0)
    : 0;
  const purokFees   = inCreated.reduce((s, r) => s + num(r.purokClearanceFee), 0);
  const avgTicket   = paid.length ? periodTotal / paid.length : 0;

  const rangeLabel = from || to
    ? `${from || '…'} to ${to || '…'} · by date paid`
    : 'All records · by date paid';

  /* ── income by category ── */
  const byCat = CATEGORIES.map((c) => {
    const rows = paid.filter((r) => incomeCategory(r.documentType) === c);
    const amount = rows.reduce((s, r) => s + num(r.amountPaid), 0);
    return { name: c, count: rows.length, amount };
  }).filter((d) => d.count > 0);

  const catChart = byCat.map((c) => ({ name: c.name.replace('Certificate of ', 'Cert. '), amount: c.amount }));

  /* ── monthly collections + running fund balance (last 6 months) ── */
  const months = lastMonths(6);
  let running = paidAll
    .filter((r) => settledAt(r) < months[0].start)
    .reduce((s, r) => s + num(r.amountPaid), 0);
  const monthly = months.map((m) => {
    const rows   = paidAll.filter((r) => { const t = settledAt(r); return t >= m.start && t < m.end; });
    const amount = rows.reduce((s, r) => s + num(r.amountPaid), 0);
    running += amount;
    return { name: m.key, amount, count: rows.length, balance: running };
  });

  /* ── payment status breakdown ── */
  const paymentRadial = [
    { name: 'Paid',   value: paid.length,   fill: GREEN },
    { name: 'Unpaid', value: unpaid.length, fill: '#F59E0B' },
    { name: 'Free',   value: free.length,   fill: '#3B82F6' },
  ].filter((d) => d.value > 0);

  /* ── detailed collections ── */
  const detail = [...paid].sort((a, b) => settledAt(b) - settledAt(a));
  const csvRows = detail.map((r) => ({
    Name:      r.profile?.fullName || r.user?.username || '—',
    Category:  incomeCategory(r.documentType),
    Type:      r.documentType,
    OR_Number: r.orNumber || '—',
    Amount:    num(r.amountPaid).toFixed(2),
    Date_Paid: settledAt(r).toLocaleDateString('en-PH'),
  }));

  return (
    <div className="flex flex-col gap-4">
      <PrintStyle />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <StatCard label="COLLECTIONS" sublabel="THIS PERIOD"  value={money0(periodTotal)} sub={`${paid.length} transactions`} />
        <StatCard label="FUND"        sublabel="BALANCE"       value={money0(fundBalance)} sub="cumulative, all records" />
        <StatCard label="AVG"         sublabel="PER PAYMENT"   value={money0(avgTicket)} />
        <StatCard label="PUROK"       sublabel="CLEARANCE FEES" value={money0(purokFees)} sub="collected for puroks" />
      </div>

      {/* ── charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Income by Category (₱)">
          {catChart.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={catChart} layout="vertical" barSize={18} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#F0EAEA" />
                <XAxis type="number" tickFormatter={(v) => `₱${v}`} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip money />} cursor={{ fill: '#F9F7F7' }} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                  {catChart.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Payment Status Breakdown">
          {paymentRadial.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={230}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={paymentRadial} startAngle={180} endAngle={-180}>
                <RadialBar dataKey="value" cornerRadius={6} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: "'Hahmlet',sans-serif", color: '#A18D8D', fontSize: 11 }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Monthly Collections (₱) — last 6 months">
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#F0EAEA" />
            <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `₱${v}`} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<ChartTooltip money />} />
            <Line type="monotone" dataKey="amount" name="Collected" stroke={GREEN} strokeWidth={2.5} dot={{ r: 4, fill: GREEN }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Barangay Fund Balance — running total">
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gFund" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F0EAEA" />
            <XAxis dataKey="name" tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 11, fill: '#A18D8D' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `₱${v}`} tick={{ fontFamily: "'Hahmlet',sans-serif", fontSize: 10, fill: '#A18D8D' }} axisLine={false} tickLine={false} width={64} />
            <Tooltip content={<ChartTooltip money />} />
            <Area type="monotone" dataKey="balance" name="Fund balance" stroke={GREEN} fill="url(#gFund)" strokeWidth={2} dot={{ r: 3, fill: GREEN }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── printable financial summary ── */}
      <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 15 }}>Financial Summary</p>
          <ReportToolbar csvRows={csvRows} csvName={`financial-summary_${new Date().toISOString().slice(0, 10)}.csv`} title="Financial Summary" />
        </div>

        <div id="print-area">
          <PrintHeader title="Financial Summary" subtitle={rangeLabel} />
          <p className="mb-4" style={{ fontFamily: "'Kaisei Decol',serif", color: GREEN, fontSize: 13 }}>{rangeLabel}</p>

          <MiniTable
            caption="Income by Category"
            head={['Category', 'Transactions', 'Amount', '% of Total']}
            align={['left', 'right', 'right', 'right']}
            rows={byCat.map((c) => [
              c.name,
              c.count,
              money(c.amount),
              periodTotal ? `${((c.amount / periodTotal) * 100).toFixed(1)}%` : '0%',
            ])}
            foot={['TOTAL INCOME', paid.length, money(periodTotal), '100%']}
          />

          <MiniTable
            caption="Barangay Fund Position (cumulative — income only, no expenses recorded)"
            head={['', 'Amount']}
            align={['left', 'right']}
            rows={[
              ['Collections prior to period', money(priorTotal)],
              ['Collections this period', money(periodTotal)],
              ['Purok clearance fees collected (this period)', money(purokFees)],
            ]}
            foot={['FUND BALANCE TO DATE', money(fundBalance)]}
          />

          <MiniTable
            caption="Monthly Collections — last 6 months"
            head={['Month', 'Transactions', 'Collected', 'Running Balance']}
            align={['left', 'right', 'right', 'right']}
            rows={monthly.map((m) => [m.name, m.count, money(m.amount), money(m.balance)])}
          />

          <MiniTable
            caption={`Detailed Collections — ${detail.length} transaction${detail.length !== 1 ? 's' : ''}`}
            head={['Name', 'Category', 'OR No.', 'Amount', 'Date Paid']}
            align={['left', 'left', 'left', 'right', 'left']}
            rows={detail.map((r) => [
              r.profile?.fullName || r.user?.username || '—',
              incomeCategory(r.documentType),
              r.orNumber || '—',
              money(r.amountPaid),
              settledAt(r).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
            ])}
            foot={['TOTAL', '', '', money(periodTotal), '']}
          />
        </div>
      </div>
    </div>
  );
}
