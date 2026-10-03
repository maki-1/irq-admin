import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Keep acknowledgments per resident and per decision, including a later
// rejection of the same request after it has been restored. Store no remarks.
const acknowledged = new Map();
const storageKey = (residentId) => `irequestd-rejections:${residentId}`;
const decisionKey = (request) => `${request._id || request.id}:${request.purokLeaderAt || request.updatedAt || request.createdAt || 'legacy'}`;

function readAcknowledged(residentId) {
  const seen = acknowledged.get(residentId) || new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(residentId)) || '[]');
    if (Array.isArray(saved)) saved.filter((key) => typeof key === 'string').forEach((key) => seen.add(key));
  } catch { /* In-memory acknowledgments still work if browser storage is unavailable. */ }
  acknowledged.set(residentId, seen);
  return seen;
}

export default function RequestRejectionNotice({ residentId }) {
  const [requests, setRequests] = useState([]);
  const dialog = useRef(null);
  const navigate = useNavigate();
  const current = requests[0];
  const currentKey = current ? decisionKey(current) : null;

  useEffect(() => {
    if (!residentId) return;
    let stopped = false;
    let loading = false;
    const controller = new AbortController();
    async function refresh() {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const { data } = await api.get('/my/requests', { signal: controller.signal });
        const all = data.data || data.requests || data || [];
        const seen = readAcknowledged(residentId);
        if (!stopped && Array.isArray(all)) {
          setRequests(all.filter((request) =>
            request.purokLeaderStatus?.toLowerCase() === 'rejected' && !seen.has(decisionKey(request))
          ).sort((a, b) => new Date(b.purokLeaderAt || b.updatedAt || b.createdAt) - new Date(a.purokLeaderAt || a.updatedAt || a.createdAt)));
        }
      } catch { /* Retry on the next poll or when the resident returns to the tab. */ }
      finally { loading = false; }
    }
    function onStorage(event) {
      if (event.key === storageKey(residentId)) {
        const seen = readAcknowledged(residentId);
        setRequests((all) => all.filter((request) => !seen.has(decisionKey(request))));
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [residentId]);

  useEffect(() => {
    const element = dialog.current;
    if (currentKey && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [currentKey]);

  function dismiss() {
    if (!current) return;
    const seen = readAcknowledged(residentId);
    seen.add(currentKey);
    try { localStorage.setItem(storageKey(residentId), JSON.stringify([...seen])); } catch { /* Use memory fallback. */ }
    setRequests((all) => all.filter((request) => decisionKey(request) !== currentKey));
  }

  if (!current) return null;
  return createPortal(
    <dialog ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="request-rejection-title" aria-describedby="request-rejection-description request-rejection-reason"
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl p-6 shadow-xl backdrop:bg-black/50"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <h2 id="request-rejection-title" className="text-lg font-bold text-red-700">Request rejected</h2>
      <p id="request-rejection-description" className="mt-3 text-sm text-gray-700">
        Your Purok Leader rejected your request for <strong>{current.documentType || 'a document'}</strong>.
      </p>
      <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm">
        <p className="font-semibold text-red-800">Reason</p>
        <p id="request-rejection-reason" className="mt-1 whitespace-pre-wrap break-words text-gray-700">{current.purokLeaderRemarks || 'No reason was provided. Please contact your Purok Leader for details.'}</p>
      </div>
      {requests.length > 1 && <p className="mt-3 text-xs text-gray-500">{requests.length - 1} more rejection notice(s) to review.</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button autoFocus onClick={dismiss} className="btn-primary flex-1">OK</button>
        <button onClick={() => { dismiss(); navigate('/requests?tab=rejected'); }} className="btn-outline flex-1">View requests</button>
      </div>
    </dialog>,
    document.body
  );
}
