import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import useAuthStore from '../../store/authStore';
import CaptainLayout from '../../components/layouts/CaptainLayout';
import { getDocuments, signDocument, sealDocument } from '../../services/document.service';
import { getVerificationStats, getPurokStats } from '../../services/verification.service';
import { getRequests } from '../../services/request.service';

/* ── Circular progress ring (same as Secretary dashboard) ── */
function CircleProgress({ value = 0, total = 1 }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#E0E0E0" strokeWidth="5" />
      <circle
        cx="24" cy="24" r={r}
        fill="none" stroke="#156D07" strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="28" textAnchor="middle" fontSize="9" fill="#918F8F"
        fontFamily="'Hanken Grotesk', sans-serif">{pct}%</text>
    </svg>
  );
}

function PurokTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl px-3 py-2" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#A18D8D', fontSize: 11 }}>{label}</p>
      <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 14 }}>
        {payload[0].value} user{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default function CaptainDashboard() {
  const { user } = useAuthStore();
  const [docs, setDocs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [residentStats, setResidentStats] = useState({ total: 0, pending: 0 });
  const [purokStats, setPurokStats] = useState([]);

  const fetchData = () => {
    getDocuments().then((r) => setDocs(r.data)).catch(() => {});
    getRequests().then((r) => setRequests(r.data)).catch(() => {});
    getVerificationStats().then((r) => setResidentStats(r.data)).catch(() => {});
    getPurokStats().then((r) => setPurokStats(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleSign = async (id) => {
    try {
      await signDocument(id);
      toast.success('Document signed');
      fetchData();
    } catch { toast.error('Failed to sign'); }
  };

  const handleSeal = async (id) => {
    try {
      await sealDocument(id);
      toast.success('Document sealed');
      fetchData();
    } catch { toast.error('Failed to seal'); }
  };

  // Computed stats
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const totalResidents    = residentStats.total;
  const pendingRequests   = requests.filter((r) => r.status?.toLowerCase() === 'pending');
  const clearancesMonth   = requests.filter((r) =>
    r.documentType === 'Barangay Clearance' &&
    r.status?.toLowerCase() === 'completed' &&
    new Date(r.updatedAt) >= monthStart
  ).length;

  const toSign = docs.filter((d) => d.status === 'Printing' && !d.signatureStatus);
  const toSeal = docs.filter((d) => d.signatureStatus === 'Signed' && !d.sealStatus);

  const recentPending = pendingRequests.slice(0, 8);
  const firstName = user?.fullName?.split(' ')[0] || 'Captain';

  return (
    <CaptainLayout title="DASHBOARD">
      <div className="flex flex-col lg:flex-row gap-4 min-w-0 flex-1 min-h-0">

        {/* ── Centre column ── */}
        <div className="flex flex-col flex-1 gap-3 min-w-0 min-h-0">

          {/* Welcome card */}
          <div
            className="relative flex items-center rounded-3xl"
            style={{ background: '#156D07', height: 145, boxShadow: '0 4px 8px rgba(0,0,0,0.2)', overflow: 'visible' }}
          >
            <div className="flex flex-col gap-2 px-6 py-5 z-10" style={{ maxWidth: '65%' }}>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#FFFFFF', fontSize: 'clamp(18px,2.5vw,24px)', fontWeight: 400, lineHeight: 1.2 }}>
                Hello {firstName}!
              </p>
              <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#FFFFFF', fontSize: 'clamp(12px,1.5vw,14px)', lineHeight: 1.6 }}>
                You have <strong>{pendingRequests.length}</strong> pending request{pendingRequests.length !== 1 ? 's' : ''} and <strong>{toSign.length}</strong> document{toSign.length !== 1 ? 's' : ''} awaiting your signature.
              </p>
            </div>
          </div>

          {/* Summary heading */}
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 20, fontWeight: 400 }}>
            Summary for today
          </p>

          {/* Stat cards — 2 × 2 grid */}
          <div className="grid grid-cols-2 gap-3">

            {/* Total Residents */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>TOTAL</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>RESIDENTS</p>
              </div>
              <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 44, lineHeight: 1 }}>
                {totalResidents}
              </span>
            </div>

            {/* Pending Requests */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>PENDING</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>REQUESTS</p>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 36, lineHeight: 1 }}>
                  {pendingRequests.length}
                </span>
                <CircleProgress value={pendingRequests.length} total={requests.length || 1} />
              </div>
            </div>

            {/* Clearances this month */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>CLEARANCES</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>THIS MONTH</p>
              </div>
              <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 44, lineHeight: 1 }}>
                {clearancesMonth}
              </span>
            </div>

            {/* Awaiting Signature */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>AWAITING</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>SIGNATURE</p>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 36, lineHeight: 1 }}>
                  {toSign.length}
                </span>
                <CircleProgress value={toSign.length} total={(toSign.length + toSeal.length) || 1} />
              </div>
            </div>
          </div>

          {/* Residents per Purok bar chart */}
          <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <p className="mb-4" style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
              Residents per Purok
            </p>
            {purokStats.length === 0 ? (
              <p className="text-center text-sm py-6" style={{ color: '#C0B0B0' }}>No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={purokStats} barSize={32} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F0EAEA" />
                  <XAxis
                    dataKey="purok"
                    tick={{ fontFamily: "'Hahmlet', sans-serif", fontSize: 10, fill: '#A18D8D' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontFamily: "'Hahmlet', sans-serif", fontSize: 10, fill: '#A18D8D' }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<PurokTooltip />} cursor={{ fill: '#F0FDF4' }} />
                  <Bar dataKey="count" fill="#156D07" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4 lg:shrink-0 w-full lg:w-72 xl:w-80 min-h-0">

          {/* Pending Requests */}
          <div className="bg-white rounded-3xl p-5 flex flex-col" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <p className="mb-3" style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
              Pending Requests
            </p>
            <div className="flex justify-between pb-2 mb-1" style={{ borderBottom: '1px solid #F0EAEA' }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13, fontWeight: 700 }}>Name</span>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13, fontWeight: 700 }}>Document</span>
            </div>
            <ul className="flex flex-col gap-2">
              {recentPending.map((req) => {
                const name = req.profile?.fullName || req.user?.username || '?';
                return (
                  <li key={req._id} className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid #FAF7F7' }}>
                    {req.user?.avatar
                      ? <img src={req.user.avatar} alt={name} className="w-9 h-9 rounded-full shrink-0 object-cover" />
                      : <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ background: '#156D07' }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                    }
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, fontWeight: 700 }}>{name}</span>
                      <span className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 10 }}>{req.profile?.purok || '—'}</span>
                    </div>
                    <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 10, maxWidth: 90, textAlign: 'right', lineHeight: 1.3, flexShrink: 0 }}>
                      {req.documentType}
                    </span>
                  </li>
                );
              })}
              {recentPending.length === 0 && (
                <li className="py-3 text-center text-xs" style={{ color: '#C0B0B0' }}>No pending requests</li>
              )}
            </ul>
          </div>

          {/* Awaiting Seal */}
          <div className="bg-white rounded-3xl p-5 flex flex-col flex-1 min-h-0" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <p className="mb-3 shrink-0" style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
              Awaiting Seal
            </p>
            <div className="flex justify-between pb-2 mb-1 shrink-0" style={{ borderBottom: '1px solid #F0EAEA' }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13, fontWeight: 700 }}>Document</span>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13, fontWeight: 700 }}>Action</span>
            </div>
            <ul className="flex flex-col overflow-y-auto flex-1 min-h-0">
              {toSeal.map((doc) => (
                <li key={doc._id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #FAF7F7' }}>
                  <div className="min-w-0 mr-3">
                    <p className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, fontWeight: 700 }}>
                      {doc.resident?.fullName || doc.fullName || '—'}
                    </p>
                    <p className="truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 10 }}>
                      {doc.customId}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSeal(doc._id)}
                    className="shrink-0 px-3 py-1 rounded-xl text-white text-xs font-medium transition-colors hover:opacity-90"
                    style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}
                  >
                    Seal
                  </button>
                </li>
              ))}
              {toSeal.length === 0 && (
                <li className="py-3 text-center text-xs" style={{ color: '#C0B0B0' }}>No documents awaiting seal</li>
              )}
            </ul>
          </div>
        </div>

      </div>
    </CaptainLayout>
  );
}
