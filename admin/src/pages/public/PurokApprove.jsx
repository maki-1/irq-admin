import { useEffect, useState } from 'react';
import api from '../../services/api';

/* Public, session-less approval page reached from the Purok Leader's SMS.
   The signed link in the URL (lid/exp/sig) is the only authorisation; the
   backend re-verifies it on every call and scopes everything to the leader's
   own purok. */

const GREEN = '#156D07';

function params() {
  const q = new URLSearchParams(window.location.search);
  return { lid: q.get('lid'), exp: q.get('exp'), sig: q.get('sig') };
}

export default function PurokApprove() {
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(null); // requestId currently acting
  const [done, setDone] = useState({});   // requestId -> 'approved' | 'rejected'
  const p = params();

  async function load() {
    setState({ loading: true });
    try {
      const { data } = await api.get('/purok-approve/pending', { params: p });
      setState({ loading: false, ok: true, leader: data.leader, requests: data.requests || [] });
    } catch (err) {
      setState({ loading: false, ok: false, message: err.response?.data?.message || 'This link is invalid or has expired.' });
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(requestId, action) {
    setBusy(requestId);
    try {
      await api.post('/purok-approve/action', { ...p, requestId, action });
      setDone((d) => ({ ...d, [requestId]: action === 'approve' ? 'approved' : 'rejected' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed. The link may have expired.');
    } finally {
      setBusy(null);
    }
  }

  const wrap = { minHeight: '100vh', background: '#F5F3F2', display: 'flex', justifyContent: 'center', padding: '24px 14px', fontFamily: "'Hanken Grotesk', sans-serif" };
  const card = { width: '100%', maxWidth: 520, background: '#fff', borderRadius: 20, boxShadow: '0 6px 24px rgba(0,0,0,0.08)', overflow: 'hidden' };

  if (state.loading) {
    return <div style={wrap}><div style={{ ...card, padding: 32, textAlign: 'center', color: '#999' }}>Loading…</div></div>;
  }
  if (!state.ok) {
    return (
      <div style={wrap}>
        <div style={{ ...card, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 40 }}>⚠️</p>
          <p style={{ color: '#B91C1C', fontWeight: 700, marginTop: 8 }}>{state.message}</p>
          <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>Please sign in to the iRequestDologon portal to review requests.</p>
        </div>
      </div>
    );
  }

  const pending = state.requests.filter((r) => !done[r.id]);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background: GREEN, color: '#fff', padding: '18px 22px' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", fontSize: 19, fontWeight: 700 }}>Purok Clearance Approval</p>
          <p style={{ fontSize: 13, opacity: 0.9 }}>
            {state.leader?.fullName} · {state.leader?.purok}
          </p>
        </div>

        <div style={{ padding: 16 }}>
          {state.requests.length === 0 && (
            <p style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>No pending requests right now. 🎉</p>
          )}

          {state.requests.map((r) => {
            const outcome = done[r.id];
            return (
              <div key={r.id} style={{ border: '1px solid #EFEAEA', borderRadius: 14, padding: 14, marginBottom: 12, background: outcome ? '#FAFAFA' : '#fff' }}>
                <p style={{ fontWeight: 700, color: '#222' }}>
                  {r.residentName}
                  {r.channel === 'kiosk' && (
                    <span style={{ marginLeft: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>AT COUNTER</span>
                  )}
                </p>
                <p style={{ color: '#555', fontSize: 14, marginTop: 2 }}>{r.documentType}{r.purpose ? ` · ${r.purpose}` : ''}</p>
                {r.residentAddress && <p style={{ color: '#A18D8D', fontSize: 12, marginTop: 2 }}>{r.residentAddress}</p>}
                {r.orNumber && <p style={{ color: '#A18D8D', fontSize: 11, marginTop: 2 }}>OR: {r.orNumber}</p>}

                {outcome ? (
                  <p style={{ marginTop: 10, fontWeight: 700, color: outcome === 'approved' ? GREEN : '#B91C1C' }}>
                    {outcome === 'approved' ? '✓ Approved' : '✕ Rejected'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      onClick={() => act(r.id, 'approve')}
                      disabled={busy === r.id}
                      style={{ flex: 1, background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, opacity: busy === r.id ? 0.6 : 1 }}>
                      {busy === r.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => act(r.id, 'reject')}
                      disabled={busy === r.id}
                      style={{ flex: 1, background: '#fff', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, opacity: busy === r.id ? 0.6 : 1 }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {pending.length === 0 && state.requests.length > 0 && (
            <p style={{ textAlign: 'center', color: GREEN, fontWeight: 700, padding: '8px 0' }}>All done — thank you!</p>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#B9AEAE', fontSize: 11, padding: '0 0 16px' }}>
          Barangay Dologon · iRequestDologon
        </p>
      </div>
    </div>
  );
}
