import { useEffect, useState, useCallback } from 'react';
import { MdContentCopy, MdPayment } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const TABS = ['Active', 'Ready for Pickup', 'Claimed'];

/* ── Claim Slip ──────────────────────────────────────────── */
function ClaimSlip({ doc }) {
  const completedAt = doc.completedAt
    ? new Date(doc.completedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  function copy() {
    navigator.clipboard.writeText(doc.claimCode);
    toast.success('Claim code copied!');
  }

  return (
    <div className="card mb-3 overflow-hidden p-0">
      {/* Header strip */}
      <div className="bg-forest px-5 py-3">
        <p className="text-white text-xs font-semibold tracking-widest uppercase opacity-80">
          Barangay Dologon — iRequestDologon
        </p>
        <p className="text-white font-bold text-base mt-0.5">Claim Slip</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Document info */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-gray-800 text-sm">{doc.documentType}</p>
            <p className="text-xs text-gray-500 mt-0.5">{doc.request?.purpose || '—'}</p>
            {doc.fullName && (
              <p className="text-xs text-gray-500 mt-0.5">
                Prepared for: <span className="font-medium text-gray-700">{doc.fullName}</span>
              </p>
            )}
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            Ready
          </span>
        </div>

        {/* Claim code */}
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 font-semibold uppercase tracking-widest mb-1">Claim Code</p>
            <p className="text-3xl font-extrabold text-primary tracking-widest">{doc.claimCode}</p>
          </div>
          <button
            onClick={copy}
            className="w-10 h-10 rounded-xl bg-white border border-green-200 flex items-center justify-center text-primary hover:bg-green-50 active:scale-95 transition-all"
          >
            <MdContentCopy size={18} />
          </button>
        </div>

        {/* Footer details */}
        <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5">
          <p className="text-xs text-gray-500">
            Date Prepared: <span className="font-medium text-gray-700">{completedAt}</span>
          </p>
          {doc.request?.orNumber && (
            <p className="text-xs text-gray-500">
              OR No.: <span className="font-medium text-gray-700">{doc.request.orNumber}</span>
            </p>
          )}
          {doc.request?.controlNumber && (
            <p className="text-xs text-gray-500">
              Control No.: <span className="font-medium text-gray-700">{doc.request.controlNumber}</span>
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-700 font-semibold mb-1">How to Claim</p>
          <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
            <li>Present this Claim Code at the Barangay Hall</li>
            <li>Office hours: Mon – Fri, 8:00 AM – 5:00 PM</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Claimed Card ────────────────────────────────────────── */
function ClaimedCard({ doc }) {
  const claimedAt = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className="card mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">{doc.documentType}</p>
          <p className="text-sm text-gray-500">{doc.request?.purpose || '—'}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          Claimed
        </span>
      </div>

      <div className="text-xs text-gray-400 space-y-0.5">
        <p>Claim Code: <span className="font-mono font-semibold text-gray-600 tracking-widest">{doc.claimCode}</span></p>
        {doc.request?.orNumber && <p>OR No.: <span className="text-gray-600 font-medium">{doc.request.orNumber}</span></p>}
        {doc.request?.controlNumber && <p>Control No.: <span className="text-gray-600 font-medium">{doc.request.controlNumber}</span></p>}
        <p>Claimed on: <span className="text-gray-600">{claimedAt}</span></p>
      </div>
    </div>
  );
}

/* ── Active Request Card ─────────────────────────────────── */
function RequestCard({ request }) {
  const [paying, setPaying] = useState(false);
  const awaitingApproval = request.purokLeaderStatus === 'pending' && request.status === 'Pending';
  const canPay          = request.purokLeaderStatus === 'approved' && request.paymentStatus === 'unpaid';

  async function handlePay() {
    setPaying(true);
    try {
      const { data } = await api.post(`/payment/pay-approved/${request._id || request.id}`);
      const checkoutUrl = data.checkoutUrl || data.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start payment');
      setPaying(false);
    }
  }

  return (
    <div className="card mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800">{request.documentType || request.type}</p>
          <p className="text-sm text-gray-500">{request.purpose}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="text-xs text-gray-400 space-y-0.5">
        {request.orNumber    && <p>OR No.: <span className="text-gray-600 font-medium">{request.orNumber}</span></p>}
        {request.controlNumber && <p>Control No.: <span className="text-gray-600 font-medium">{request.controlNumber}</span></p>}
        {request.createdAt   && (
          <p>Requested: {new Date(request.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
        )}
      </div>

      {awaitingApproval && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <p className="text-xs text-amber-700 font-semibold">⏳ Awaiting Purok Leader Approval</p>
          <p className="text-xs text-amber-600 mt-0.5">Payment will be enabled once your Purok Leader approves this request.</p>
        </div>
      )}

      {request.purokLeaderStatus === 'rejected' && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <p className="text-xs text-red-700 font-semibold">✕ Rejected by Purok Leader</p>
          {request.purokLeaderRemarks && (
            <p className="text-xs text-red-600 mt-0.5">Reason: {request.purokLeaderRemarks}</p>
          )}
        </div>
      )}

      {canPay && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-3 text-sm font-bold disabled:opacity-60"
        >
          {paying ? <LoadingSpinner size="sm" /> : <><MdPayment size={18} /> Pay Now</>}
        </button>
      )}

    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function Requests() {
  const [tab, setTab]           = useState(0);
  const [requests, setRequests] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading]   = useState(true);

  const loadActive = useCallback(async () => {
    const { data } = await api.get('/my/requests');
    const all = data.data || data.requests || data || [];
    setRequests(Array.isArray(all) ? all : []);
  }, []);

  const loadCompleted = useCallback(async (claimStatus) => {
    const { data } = await api.get(`/my/requests/completed?status=${claimStatus}`);
    setCompleted(Array.isArray(data) ? data : []);
  }, []);

  async function load() {
    setLoading(true);
    try {
      if (tab === 0) await loadActive();
      else if (tab === 1) await loadCompleted('pending');
      else await loadCompleted('claimed');
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') load(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [tab]);

  const activeItems = requests.filter((r) =>
    ['Pending', 'Processing', 'Printing'].includes(r.status)
  );

  const displayItems = tab === 0 ? activeItems : completed;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">My Requests</h1>
        <p className="text-gray-500 text-sm mt-1">Track all your document requests</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border border-black/[0.04] shadow-sm rounded-full p-1 mb-6 gap-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-2 px-3 rounded-full text-sm font-semibold transition-all
              ${tab === i ? 'bg-forest text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner size="lg" className="py-12" />
      ) : displayItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">
            {tab === 0 ? '📋' : tab === 1 ? '🏷️' : '✅'}
          </div>
          <p className="text-gray-500 font-medium">No {TABS[tab].toLowerCase()} requests</p>
          <p className="text-gray-400 text-sm mt-1">Your requests will appear here</p>
        </div>
      ) : tab === 0 ? (
        activeItems.map((r) => (
          <RequestCard key={r._id || r.id} request={r} />
        ))
      ) : tab === 1 ? (
        completed.map((doc) => (
          <ClaimSlip key={doc._id} doc={doc} />
        ))
      ) : (
        completed.map((doc) => (
          <ClaimedCard key={doc._id} doc={doc} />
        ))
      )}
    </AppLayout>
  );
}
