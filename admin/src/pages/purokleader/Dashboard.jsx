import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiUsers, FiUserCheck, FiCalendar } from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildMonthlyData(residents, year) {
  const counts = Array(12).fill(0);
  residents.forEach((p) => {
    const d = new Date(p.createdAt);
    if (d.getFullYear() === year) counts[d.getMonth()]++;
  });
  return MONTHS.map((month, i) => ({ month, registered: counts[i] }));
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl px-4 py-2.5"
      style={{ background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #F0EAEA' }}>
      <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 13 }}>{label}</p>
      <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 700 }}>
        {payload[0].value} registered
      </p>
    </div>
  );
}

export default function PurokLeaderDashboard() {
  const { user } = useAuthStore();
  const [residents, setResidents] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [year,      setYear]      = useState(new Date().getFullYear());

  useEffect(() => {
    api.get('/verifications')
      .then(({ data }) => setResidents(data.filter((p) => p.facePhoto)))
      .catch(() => toast.error('Failed to load residents'))
      .finally(() => setLoading(false));
  }, []);

  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const monthlyData  = buildMonthlyData(residents, year);
  const thisMonthCount = residents.filter((p) => {
    const d = new Date(p.createdAt);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }).length;

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <PurokLeaderLayout title="DASHBOARD">
      <div className="flex flex-col gap-4">

        {/* Welcome card */}
        <div className="bg-white rounded-3xl px-6 py-5"
          style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 18 }}>
            Welcome, {user?.fullName}
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 4 }}>
            Purok Leader — {user?.purok}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="bg-white rounded-3xl px-6 py-5 flex items-center gap-4"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: '#F3F0FF' }}>
              <FiUsers size={22} color="#7C3AED" />
            </div>
            <div>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>Total Residents</p>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#333', fontSize: 26, fontWeight: 700 }}>
                {loading ? '…' : residents.length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl px-6 py-5 flex items-center gap-4"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: '#F0FDF4' }}>
              <FiUserCheck size={22} color="#16A34A" />
            </div>
            <div>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>Registered This Month</p>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#333', fontSize: 26, fontWeight: 700 }}>
                {loading ? '…' : thisMonthCount}
              </p>
            </div>
          </div>

        </div>

        {/* Population bar chart */}
        <div className="bg-white rounded-3xl p-5"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 16 }}>
                Registered Accounts
              </p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11, marginTop: 2 }}>
                Monthly registrations for {year}
              </p>
            </div>

            {/* Year selector */}
            <div className="flex items-center gap-1.5">
              <FiCalendar size={13} color="#A18D8D" />
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-xl px-3 py-1.5 text-xs focus:outline-none appearance-none"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  background: '#F3F0FF', border: '1px solid #E9D5FF',
                  color: '#7C3AED', fontWeight: 600,
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-56">
              <p style={{ color: '#C0B0B0', fontSize: 13, fontFamily: "'Hanken Grotesk', sans-serif" }}>Loading…</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#F0EAEA" />
                <XAxis
                  dataKey="month"
                  tick={{ fontFamily: "'Hahmlet', sans-serif", fontSize: 11, fill: '#A18D8D' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontFamily: "'Hahmlet', sans-serif", fontSize: 10, fill: '#A18D8D' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F3F0FF' }} />
                <Bar
                  dataKey="registered"
                  fill="#7C3AED"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Summary row */}
          {!loading && (
            <div className="flex flex-wrap gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              {monthlyData
                .filter((m) => m.registered > 0)
                .sort((a, b) => b.registered - a.registered)
                .slice(0, 4)
                .map(({ month, registered }) => (
                  <div key={month} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#7C3AED' }} />
                    <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                      {month}: <strong style={{ color: '#333' }}>{registered}</strong>
                    </span>
                  </div>
                ))
              }
              {monthlyData.every((m) => m.registered === 0) && (
                <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                  No registrations in {year}
                </p>
              )}
            </div>
          )}
        </div>

      </div>
    </PurokLeaderLayout>
  );
}
