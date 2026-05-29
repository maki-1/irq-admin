import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdAddCircle, MdArticle, MdPending, MdSync, MdCheckCircle, MdCancel, MdInventory } from 'react-icons/md';
import api from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import useAuthStore from '../../store/authStore';

function SummaryCard({ icon: Icon, label, count, color, bg }) {
  return (
    <div className={`card flex items-center gap-4 ${bg}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-800">{count ?? '—'}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, reqRes, profileRes] = await Promise.all([
          api.get('/my/requests/summary'),
          api.get('/my/requests'),
          api.get('/verification/status'),
        ]);
        setSummary(sumRes.data.data || sumRes.data);
        const requests = reqRes.data.data || reqRes.data.requests || reqRes.data || [];
        setRecent(Array.isArray(requests) ? requests.slice(0, 5) : []);
        setFullName(profileRes.data.fullName || null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const readyCount = summary?.ready ?? summary?.Ready ?? 0;

  return (
    <AppLayout>
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary to-green-700 rounded-2xl px-6 py-5 mb-6 text-white">
        <p className="text-white/80 text-sm mb-1">Good day,</p>
        <h1 className="text-2xl font-extrabold">{fullName || user?.username} 👋</h1>
        {readyCount > 0 && (
          <div className="mt-2 inline-block bg-gold text-gray-900 text-xs font-bold px-3 py-1 rounded-full">
            {readyCount} document{readyCount > 1 ? 's' : ''} ready for pickup!
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <SummaryCard icon={MdArticle} label="Total Requests" count={summary?.total} color="bg-gray-600" bg="" />
            <SummaryCard icon={MdPending} label="Pending" count={summary?.pending ?? summary?.Pending} color="bg-yellow-500" bg="" />
            <SummaryCard icon={MdSync} label="Processing" count={summary?.processing ?? summary?.Processing} color="bg-blue-500" bg="" />
            <SummaryCard icon={MdCheckCircle} label="Ready for Pickup" count={readyCount} color="bg-primary" bg="" />
            <SummaryCard icon={MdCancel} label="Rejected" count={summary?.rejected ?? summary?.Rejected} color="bg-red-500" bg="" />
            <SummaryCard icon={MdInventory} label="Claimed" count={summary?.claimed ?? summary?.Claimed} color="bg-gray-400" bg="" />
          </div>

          {/* Quick actions */}
          <div className="flex gap-3 mb-6">
            <Link to="/request/new" className="flex-1 bg-primary text-white rounded-xl py-3 px-4 flex items-center gap-2 font-semibold text-sm hover:bg-green-800 active:scale-95 transition-all">
              <MdAddCircle size={20} /> Request Document
            </Link>
            <Link to="/requests" className="flex-1 border-2 border-primary text-primary rounded-xl py-3 px-4 flex items-center gap-2 font-semibold text-sm hover:bg-primary hover:text-white active:scale-95 transition-all">
              <MdArticle size={20} /> My Requests
            </Link>
          </div>

          {/* Ready for pickup */}
          {readyCount > 0 && (
            <div className="card mb-6 bg-green-50 border-green-200">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <MdCheckCircle className="text-primary" size={20} /> Ready for Pickup
              </h3>
              {recent
                .filter((r) => r.status === 'Ready')
                .map((r) => (
                  <div key={r._id || r.id} className="flex items-center justify-between py-2 border-b border-green-100 last:border-0">
                    <div>
                      <p className="font-medium text-sm text-gray-800">{r.documentType || r.type}</p>
                      <p className="text-xs text-gray-500">{r.purpose}</p>
                    </div>
                    {r.claimCode && (
                      <div className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                        {r.claimCode}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Recent requests */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Recent Requests</h3>
              <Link to="/requests" className="text-xs text-primary font-semibold hover:underline">View all</Link>
            </div>
            {recent.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-500 text-sm">No requests yet</p>
                <Link to="/request/new" className="text-primary text-sm font-semibold hover:underline mt-1 inline-block">
                  Make your first request →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map((r) => (
                  <div key={r._id || r.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-800 truncate">{r.documentType || r.type}</p>
                      <p className="text-xs text-gray-500 truncate">{r.purpose}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.controlNumber && `Control: ${r.controlNumber}`}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
