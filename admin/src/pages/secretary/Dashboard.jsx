import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDocuments, updateStatus } from '../../services/document.service';
import { getVerificationStats, getLatestApproved } from '../../services/verification.service';
import { getReleases, getRequests } from '../../services/request.service';
import useAuthStore from '../../store/authStore';
import assets from '../../assets/cloudinaryAssets';
import SecretaryLayout from '../../components/layouts/SecretaryLayout';

/* ── Circular progress ring ── */
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

export default function SecretaryDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [residentStats, setResidentStats] = useState({ total: 0, pending: 0 });
  const [approvedResidents, setApprovedResidents] = useState([]);
  const [releases, setReleases] = useState([]);
  const [requests, setRequests] = useState([]);

  const fetchData = () => {
    getDocuments().then((r) => setDocs(r.data)).catch(() => {});
    getVerificationStats().then((r) => setResidentStats(r.data)).catch(() => {});
    getLatestApproved(6).then((r) => setApprovedResidents(r.data)).catch(() => {});
    getReleases().then((r) => setReleases(r.data)).catch(() => {});
    getRequests().then((r) => setRequests(r.data)).catch(() => {});
  };
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayRequests = requests.filter((r) => new Date(r.createdAt) >= todayStart);

  const totalRes     = residentStats.total;
  const pendingRes   = residentStats.pending;
  const pendingDocs  = todayRequests.filter((r) => r.status?.toLowerCase() === 'pending').length;
  const finishedDocs = todayRequests.filter((r) => r.status?.toLowerCase() === 'completed').length;
  const newReqs     = requests.filter((r) => r.status?.toLowerCase() === 'pending').slice(0, 5);
  const readyPickup = releases.filter((r) => r.claimStatus !== 'claimed').slice(0, 10);
  const newResidents = approvedResidents;

  const firstName = user?.fullName?.split(' ')[0] || 'Secretary';

  return (
    <SecretaryLayout title="DASHBOARD">
      <div className="flex flex-col lg:flex-row gap-4 min-w-0 flex-1 min-h-0">

        {/* ── Centre column ── */}
        <div className="flex flex-col flex-1 gap-3 min-w-0 min-h-0">

          {/* Welcome card */}
          <div
            className="relative flex items-center rounded-3xl"
            style={{ background: '#156D07', height: 145, boxShadow: '0 4px 8px rgba(0,0,0,0.2)', overflow: 'visible' }}
          >
            <div className="flex flex-col gap-2 px-6 py-5 z-10" style={{ maxWidth: '60%' }}>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#FFFFFF', fontSize: 'clamp(18px,2.5vw,24px)', fontWeight: 400, lineHeight: 1.2 }}>
                Hello {firstName}!
              </p>
              <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#FFFFFF', fontSize: 'clamp(12px,1.5vw,14px)', lineHeight: 1.6 }}>
                You have <strong>{pendingDocs}</strong> Document Request{pendingDocs !== 1 ? 's' : ''} for today, So let&apos;s start?
              </p>
              <button
                onClick={() => navigate('/secretary/requests')}
                style={{ fontFamily: "'Hahmlet', sans-serif", color: '#FCE600', fontSize: 13, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: 'fit-content' }}
              >
                Review Document
              </button>
            </div>
            <img
              src="https://res.cloudinary.com/dvw7ky1xq/image/upload/v1777136899/woman_working_with_documents_msfyzw.png" alt=""
              className="hidden lg:block absolute right-4 pointer-events-none select-none"
              style={{ height: 400, bottom: -102 }}
            />
          </div>

          {/* Summary heading */}
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 20, fontWeight: 400 }}>
            Summary for today
          </p>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>PENDING</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>RESIDENTS</p>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 36, lineHeight: 1 }}>{pendingRes}</span>
                <CircleProgress value={pendingRes} total={totalRes} />
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>TOTAL</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>RESIDENTS</p>
              </div>
              <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 44, lineHeight: 1 }}>{totalRes}</span>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 12, fontWeight: 700 }}>PENDING</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>DOCUMENTS</p>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 36, lineHeight: 1 }}>{pendingDocs}</span>
                <CircleProgress value={pendingDocs} total={todayRequests.length || 1} />
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl px-5"
              style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', height: 80 }}>
              <div>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>FINISH</p>
                <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#156D07', fontSize: 13, fontWeight: 700 }}>DOCUMENTS</p>
              </div>
              <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 44, lineHeight: 1 }}>{finishedDocs}</span>
            </div>
          </div>

          {/* Newly Registered Residents */}
          <div className="bg-white rounded-3xl p-5 flex flex-col flex-1" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)', minHeight: 0 }}>
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>Newly Registered Residents</p>
              <button
                onClick={() => navigate('/secretary/residents')}
                className="px-3 py-1 rounded-xl text-white text-xs font-medium"
                style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}
              >
                See all
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full min-w-[320px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Fullname', 'Address', 'Status'].map((h) => (
                      <th key={h} className="text-left pb-2 pr-3"
                        style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 13, fontWeight: 400 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {newResidents.map((d) => (
                    <tr key={d._id} style={{ borderTop: '1px solid #F5F0F0' }}>
                      <td className="py-2 pr-3" style={{ fontFamily: "'Inika', serif", color: '#A18D8D', fontSize: 13 }}>{d.fullName}</td>
                      <td className="py-2 pr-3" style={{ fontFamily: "'Inika', serif", color: '#A18D8D', fontSize: 13 }}>{d.address || d.purok || '—'}</td>
                      <td className="py-2"       style={{ fontFamily: "'Inika', serif", color: '#A18D8D', fontSize: 13 }}>{d.status}</td>
                    </tr>
                  ))}
                  {newResidents.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-sm" style={{ color: '#C0B0B0' }}>No residents yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4 lg:shrink-0 w-full lg:w-72 xl:w-80 min-h-0">

          {/* Ready to Pick Up */}
          <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <p className="mb-3" style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>
              READY TO PICK UP DOCS
            </p>
            <div className="flex justify-between pb-2 mb-1" style={{ borderBottom: '1px solid #F0EAEA' }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13, fontWeight: 700 }}>Name</span>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13, fontWeight: 700 }}>Claiming Code</span>
            </div>
            <ul className="flex flex-col">
              {readyPickup.map((doc) => (
                <li key={doc._id} className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid #FAF7F7' }}>
                  <span className="truncate mr-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                    {doc.fullName || doc.user?.username || '—'}
                  </span>
                  <span
                    className="shrink-0 font-mono text-xs px-1.5 py-0.5 rounded"
                    style={{ background: '#F0FDF4', color: '#156D07', letterSpacing: 1 }}
                  >
                    {doc.claimCode}
                  </span>
                </li>
              ))}
              {readyPickup.length === 0 && (
                <li className="py-3 text-center text-xs" style={{ color: '#C0B0B0' }}>No docs ready for pickup</li>
              )}
            </ul>
          </div>

          {/* New Request */}
          <div className="bg-white rounded-3xl p-5 flex flex-col flex-1 min-h-0" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>New Request</p>
              <button
                onClick={() => navigate('/secretary/requests')}
                style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                see all
              </button>
            </div>
            <div className="flex justify-between pb-2 mb-2 shrink-0"
              style={{ borderBottom: '1px solid #F0EAEA', fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
              <span>Name</span>
              <span>Requested Documents</span>
            </div>
            <ul className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
              {newReqs.map((req) => {
                const name = req.profile?.fullName || req.user?.username || '?';
                return (
                  <li key={req._id} className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid #FAF7F7' }}>
                    {req.user?.avatar
                      ? <img src={req.user.avatar} alt={name} className="w-9 h-9 rounded-full shrink-0 object-cover" />
                      : <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ background: '#156D07' }}>{name.charAt(0).toUpperCase()}</div>
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
              {newReqs.length === 0 && (
                <li className="py-3 text-center text-xs" style={{ color: '#C0B0B0' }}>No new requests</li>
              )}
            </ul>

          </div>
        </div>
      </div>
    </SecretaryLayout>
  );
}
