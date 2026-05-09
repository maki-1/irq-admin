import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import useAuthStore from '../../store/authStore';
import CollectorLayout from '../../components/layouts/CollectorLayout';
import { getRequests } from '../../services/request.service';
import { getResidentCount } from '../../services/verification.service';

function KpiCard({ label, sublabel, value, sub, accent = '#156D07', onClick }) {
  return (
    <div
      className={`flex items-center justify-between bg-white rounded-2xl px-5${onClick ? ' transition-shadow hover:shadow-lg' : ''}`}
      style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div>
        <p style={{ fontFamily: "'Hahmlet', sans-serif", color: accent, fontSize: 12, fontWeight: 700 }}>
          {label}
        </p>
        {sublabel && (
          <p style={{ fontFamily: "'Hahmlet', sans-serif", color: accent, fontSize: 12, fontWeight: 700 }}>
            {sublabel}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end">
        <span style={{ fontFamily: "'Kaisei Decol', serif", color: accent, fontSize: 36, lineHeight: 1 }}>
          {value}
        </span>
        {sub && (
          <span style={{ fontFamily: "'Hahmlet', sans-serif", color: '#A18D8D', fontSize: 10, marginTop: 2 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#A18D8D', fontSize: 11 }}>{label}</p>
      <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 14 }}>
        ₱{(payload[0].value || 0).toLocaleString()}
      </p>
    </div>
  );
}

function buildChartData(paidRequests, period) {
  const now = new Date();

  if (period === 'weekly') {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      const amount = paidRequests
        .filter((r) => { const t = new Date(r.updatedAt); return t >= d && t < next; })
        .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
      days.push({ label, amount });
    }
    return days;
  }

  if (period === 'monthly') {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const amount = paidRequests
        .filter((r) => { const t = new Date(r.updatedAt); return t >= d && t < next; })
        .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
      months.push({ label, amount });
    }
    return months;
  }

  // yearly — last 5 years
  const years = [];
  for (let i = 4; i >= 0; i--) {
    const yr = now.getFullYear() - i;
    const d = new Date(yr, 0, 1);
    const next = new Date(yr + 1, 0, 1);
    const label = String(yr);
    const amount = paidRequests
      .filter((r) => { const t = new Date(r.updatedAt); return t >= d && t < next; })
      .reduce((sum, r) => sum + (r.amountPaid || 0), 0);
    years.push({ label, amount });
  }
  return years;
}

export default function CollectorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [residentCount, setResidentCount] = useState(0);
  const [chartPeriod, setChartPeriod] = useState('weekly');

  const fetchData = () => {
    getRequests().then((r) => setRequests(r.data)).catch((err) => console.error('Failed to load requests:', err));
    getResidentCount().then((r) => setResidentCount(r.data.count)).catch((err) => console.error('Failed to load resident count:', err));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Date boundaries
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const paidRequests = requests.filter((r) => r.paymentStatus === 'paid');

  const collectionsToday = paidRequests
    .filter((r) => new Date(r.updatedAt) >= todayStart)
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

  const collectionsWeek = paidRequests
    .filter((r) => new Date(r.updatedAt) >= weekStart)
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

  const collectionsMonth = paidRequests
    .filter((r) => new Date(r.updatedAt) >= monthStart)
    .reduce((sum, r) => sum + (r.amountPaid || 0), 0);

  const totalTransactions = paidRequests.length;

  const chartData = buildChartData(paidRequests, chartPeriod);

  const recentPaid = [...paidRequests]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 10);

  const residentName = (req) => req.profile?.fullName || req.user?.username || '—';

  const firstName = user?.fullName?.split(' ')[0] || 'Collector';

  return (
    <CollectorLayout title="DASHBOARD">
      <div className="flex flex-col lg:flex-row gap-4 min-w-0 flex-1 min-h-0">

        {/* ── Centre column ── */}
        <div className="flex flex-col flex-1 gap-3 min-w-0 min-h-0">

          {/* Welcome banner */}
          <div
            className="relative flex items-center rounded-3xl overflow-hidden"
            style={{ background: '#156D07', height: 145, boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}
          >
            <div className="flex flex-col gap-2 px-6 py-5 z-10" style={{ maxWidth: '65%' }}>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#FFFFFF', fontSize: 'clamp(18px,2.5vw,24px)', fontWeight: 400, lineHeight: 1.2 }}>
                Hello {firstName}!
              </p>
              <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#FFFFFF', fontSize: 'clamp(12px,1.5vw,14px)', lineHeight: 1.6 }}>
                You have <strong>{totalTransactions}</strong> paid transaction{totalTransactions !== 1 ? 's' : ''} recorded so far.
              </p>
              <button
                onClick={() => navigate('/collector/payments')}
                style={{ fontFamily: "'Hahmlet', sans-serif", color: '#FCE600', fontSize: 13, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: 'fit-content' }}
              >
                Review Payments
              </button>
            </div>
          </div>

          {/* KPI heading */}
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 20, fontWeight: 400 }}>
            Summary for today
          </p>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">

            <KpiCard label="TOTAL" sublabel="COLLECTIONS TODAY" value={`₱${collectionsToday.toLocaleString()}`} onClick={() => navigate('/collector/payments')} />

            <KpiCard label="NUMBER OF" sublabel="TRANSACTIONS" value={totalTransactions} onClick={() => navigate('/collector/payments')} />

            {/* Collections Week / Month */}
            <div
              className="col-span-2 flex items-center justify-between bg-white rounded-2xl px-5 transition-shadow hover:shadow-lg"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80, cursor: 'pointer' }}
              onClick={() => navigate('/collector/payments')}
            >
              <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                COLLECTIONS<br />THIS WEEK / MONTH
              </p>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 28, lineHeight: 1 }}>
                    ₱{collectionsWeek.toLocaleString()}
                  </span>
                  <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#A18D8D', fontSize: 10, marginTop: 2 }}>this week</p>
                </div>
                <div style={{ width: 1, height: 40, background: '#F0EAEA' }} />
                <div className="text-right">
                  <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 28, lineHeight: 1 }}>
                    ₱{collectionsMonth.toLocaleString()}
                  </span>
                  <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#A18D8D', fontSize: 10, marginTop: 2 }}>this month</p>
                </div>
              </div>
            </div>

            {/* Active Residents */}
            <div
              className="col-span-2 flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}
            >
              <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                ACTIVE<br />RESIDENTS
              </p>
              <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 44, lineHeight: 1 }}>
                {residentCount}
              </span>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
                Collections Overview
              </p>
              <div className="flex gap-1">
                {[['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setChartPeriod(val)}
                    style={{
                      fontFamily: "'Hahmlet', sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: chartPeriod === val ? '#156D07' : '#F5F0F0',
                      color: chartPeriod === val ? '#FFFFFF' : '#A18D8D',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F0EAEA" />
                <XAxis
                  dataKey="label"
                  tick={{ fontFamily: "'Hahmlet', sans-serif", fontSize: 10, fill: '#A18D8D' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₱${v}`}
                  tick={{ fontFamily: "'Hahmlet', sans-serif", fontSize: 10, fill: '#A18D8D' }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0FDF4' }} />
                <Bar dataKey="amount" fill="#156D07" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4 lg:shrink-0 w-full lg:w-72 xl:w-80 min-h-0">

          {/* Recent Transactions */}
          <div className="bg-white rounded-3xl p-5 flex flex-col flex-1 min-h-0" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>Recent Transactions</p>
              <button
                onClick={() => navigate('/collector/payments')}
                style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                see all
              </button>
            </div>

            <div className="flex justify-between pb-2 mb-1" style={{ borderBottom: '1px solid #F0EAEA' }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, fontWeight: 700 }}>Name</span>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, fontWeight: 700 }}>Amount</span>
            </div>

            <ul className="flex flex-col overflow-y-auto flex-1 min-h-0">
              {recentPaid.map((req) => {
                const name = residentName(req);
                return (
                  <li key={req._id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #FAF7F7' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ background: '#156D07' }}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, fontWeight: 700 }}>
                          {name}
                        </p>
                        <p className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 10 }}>
                          {req.documentType}
                        </p>
                      </div>
                    </div>
                    <span
                      className="shrink-0 ml-2 font-semibold"
                      style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#156D07', fontSize: 12 }}
                    >
                      ₱{(req.amountPaid || 0).toLocaleString()}
                    </span>
                  </li>
                );
              })}
              {recentPaid.length === 0 && (
                <li className="py-6 text-center text-xs" style={{ color: '#C0B0B0' }}>
                  No transactions yet
                </li>
              )}
            </ul>
          </div>
        </div>

      </div>
    </CollectorLayout>
  );
}
