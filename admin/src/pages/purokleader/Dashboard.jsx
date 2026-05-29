import { useEffect, useState } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiFileText } from 'react-icons/fi';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const PIE_COLORS = ['#156D07', '#B45309', '#DC2626', '#2563EB', '#7C3AED', '#0891B2', '#DB2777'];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#FFFFFF' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>{label}</p>
        <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#1E1E1E', fontSize: 28, fontWeight: 700 }}>{value}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 shadow-lg" style={{ background: '#FFFFFF', border: '1px solid #F0EAEA' }}>
      <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 12, fontWeight: 600 }}>
        {payload[0].name}
      </p>
      <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 14, fontWeight: 700 }}>
        {payload[0].value} request{payload[0].value !== 1 ? 's' : ''}
      </p>
      <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
        {payload[0].payload.pct}%
      </p>
    </div>
  );
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }) {
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 700 }}>
      {pct}%
    </text>
  );
}

export default function PurokLeaderDashboard() {
  const { user }              = useAuthStore();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/purok-leader/dashboard')
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total   = data?.stats?.total ?? 0;
  const pieData = data?.stats?.byType
    ? Object.entries(data.stats.byType).map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
    : [];

  return (
    <PurokLeaderLayout title="Dashboard">
      <div className="mb-4">
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#827575', fontSize: 14 }}>
          Hello, <strong style={{ color: '#156D07' }}>{user?.fullName}</strong>! Here's your purok's overview.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={FiFileText}    label="Total Requests" value={data?.stats?.total    ?? 0} color="#156D07" />
            <StatCard icon={FiClock}       label="Pending"        value={data?.stats?.pending  ?? 0} color="#B45309" />
            <StatCard icon={FiCheckCircle} label="Approved"       value={data?.stats?.approved ?? 0} color="#156D07" />
            <StatCard icon={FiXCircle}     label="Rejected"       value={data?.stats?.rejected ?? 0} color="#DC2626" />
          </div>

          {pieData.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF' }}>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 16, marginBottom: 4 }}>
                Requests by Document Type
              </p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginBottom: 16 }}>
                {total} total request{total !== 1 ? 's' : ''}
              </p>

              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => (
                      <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 12 }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </PurokLeaderLayout>
  );
}
