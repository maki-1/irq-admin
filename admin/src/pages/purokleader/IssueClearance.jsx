import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiUserCheck, FiUserPlus, FiSearch, FiPrinter, FiPlus, FiSlash, FiX,
  FiChevronDown, FiChevronRight, FiCheckCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { logAction } from '../../services/audit.service';

const pesoFromCentavos = (c) =>
  `₱${(Number(c || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dt = (v) => (v ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const dtTime = (v) =>
  v ? new Date(v).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const STATUS_STYLE = {
  issued: { bg: '#F0FDF4', color: '#156D07', label: 'Not yet used' },
  used:   { bg: '#EFF6FF', color: '#2563EB', label: 'Used' },
  void:   { bg: '#FEF2F2', color: '#DC2626', label: 'Cancelled' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[String(status || '').toLowerCase()] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {s.label}
    </span>
  );
}

const FIELD = {
  fontFamily: "'Hanken Grotesk', sans-serif",
  background: '#F9F7F7',
  border: '1px solid #E8E0E0',
  color: '#333',
};
const LABEL = { fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13 };

const EMPTY = { userId: null, fullName: '', address: '', birthday: '', contactNumber: '', validDays: 30, feePaid: true };

/* ── Printable slip — opens a clean window, mirrors PrintReceiptModal ── */
function printSlip(clearance, purok, officerName) {
  const rows = [
    ['Control Number', clearance.controlNo],
    ['Full Name', clearance.fullName],
    ['Address', clearance.address || '—'],
    ['Purok', clearance.purok || purok],
    ['Date Issued', dt(clearance.issuedAt)],
    ['Valid Until', dt(clearance.validUntil)],
    ['Clearance Fee', `${pesoFromCentavos(clearance.feecentavos)} — ${clearance.feePaid ? 'PAID' : 'UNPAID'}`],
  ];
  const win = window.open('', '_blank', 'width=640,height=800');
  if (!win) { toast.error('Allow pop-ups to print the slip'); return; }
  win.document.write(`
    <html>
      <head>
        <title>Purok Clearance ${clearance.controlNo}</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;padding:14mm;font-family:'Times New Roman',Times,serif;color:#000}
          h1{font-size:15px;letter-spacing:2px;margin:0}
          .sub{font-size:11px;color:#333;margin-top:2px}
          .card{border:1.5px solid #000;border-radius:10px;padding:14px 16px;margin-top:14px}
          .code{font-size:30px;font-weight:bold;letter-spacing:3px;text-align:center;margin:6px 0 12px;font-family:Consolas,'Courier New',monospace}
          table{width:100%;border-collapse:collapse;font-size:12px}
          td{padding:5px 4px;vertical-align:top}
          td.k{width:38%;color:#555;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
          .note{font-size:10px;color:#555;margin-top:12px;line-height:1.5}
          .sign{margin-top:34px;text-align:right;font-size:11px}
          .sign .line{display:inline-block;border-top:1px solid #000;padding-top:3px;min-width:200px;text-align:center}
          @media print{@page{size:A5 portrait;margin:10mm}}
        </style>
      </head>
      <body>
        <div style="text-align:center">
          <h1>BARANGAY DOLOGON</h1>
          <div class="sub">Maramag, Bukidnon &bull; Office of the Purok Leader</div>
          <div class="sub" style="margin-top:6px;font-weight:bold">PUROK CLEARANCE</div>
        </div>
        <div class="card">
          <div class="code">${clearance.controlNo}</div>
          <table><tbody>
            ${rows.map(([k, v]) => `<tr><td class="k">${k}</td><td>${v ?? '—'}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="note">
          Present this slip at the Barangay Document Kiosk. Type the control number
          above, confirm your surname, and choose the documents you need. The fee
          shown is settled in cash with the Purok Leader and is not charged again
          at the kiosk. This clearance is valid for one transaction only.
        </div>
        <div class="sign"><span class="line">${officerName || 'Purok Leader'}<br/><span style="font-size:10px;color:#555">Issuing Purok Leader</span></span></div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
  logAction('Printed Purok Clearance Slip', `${clearance.controlNo} for ${clearance.fullName}`).catch(() => {});
}

/* ── Void confirmation ── */
function VoidModal({ clearance, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await api.patch(`/purok-clearance/${clearance.id || clearance._id}/void`, { reason });
      toast.success('Clearance cancelled');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#DC2626', fontSize: 18 }}>Cancel Clearance</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <FiX size={18} color="#827575" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 13, marginBottom: 12 }}>
            <strong>{clearance.controlNo}</strong> — {clearance.fullName}
          </p>
          <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Reason (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="e.g. slip lost, issued in error…"
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none" style={FIELD} />
        </div>
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}>
            Keep it
          </button>
          <button onClick={confirm} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#DC2626' }}>
            {saving ? 'Cancelling…' : 'Cancel clearance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurokLeaderIssueClearance() {
  const { user } = useAuthStore();
  const purok = user?.purok || 'your purok';

  const [source, setSource] = useState('registered'); // 'registered' | 'walkin'
  const [form, setForm] = useState(EMPTY);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState(null);

  // resident search
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  // fee for this purok
  const [feeCentavos, setFeeCentavos] = useState(null);

  // issued register
  const [register, setRegister] = useState([]);
  const [loadingRegister, setLoadingRegister] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [voidTarget, setVoidTarget] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleRow = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function loadRegister() {
    setLoadingRegister(true);
    try {
      const { data } = await api.get('/purok-clearance/issued');
      setRegister(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load the issued register');
    } finally {
      setLoadingRegister(false);
    }
  }

  useEffect(() => { loadRegister(); }, []);

  useEffect(() => {
    api.get('/purok-clearance/all-fees')
      .then(({ data }) => {
        const row = (data || []).find(
          (f) => String(f.purokName).trim().toLowerCase() === String(user?.purok || '').trim().toLowerCase()
        );
        setFeeCentavos(row ? row.feecentavos : 0);
      })
      .catch(() => setFeeCentavos(null));
  }, [user?.purok]);

  // debounced resident lookup
  useEffect(() => {
    if (source !== 'registered') return;
    // Once a resident is picked, `q` holds their name — don't re-search it and
    // pop the dropdown back open.
    if (form.userId) { setResults([]); return; }
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/purok-clearance/residents', { params: { q: q.trim() } });
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [q, source, form.userId]);

  function pickResident(r) {
    setForm({
      userId: r.userId,
      fullName: r.fullName || '',
      address: r.address || '',
      birthday: r.birthday ? String(r.birthday).slice(0, 10) : '',
      contactNumber: r.contactNumber || '',
      validDays: 30,
      feePaid: true,
    });
    setResults([]);
    setQ(r.fullName || '');
  }

  function switchSource(next) {
    setSource(next);
    setForm(EMPTY);
    setQ('');
    setResults([]);
  }

  const canIssue =
    form.fullName.trim() && form.address.trim() && form.birthday && !issuing &&
    (source === 'walkin' || form.userId);

  async function issue() {
    if (!canIssue) {
      toast.error('Full name, address and birth date are required');
      return;
    }
    setIssuing(true);
    try {
      const { data } = await api.post('/purok-clearance/issue', {
        userId: source === 'registered' ? form.userId : undefined,
        fullName: form.fullName.trim(),
        address: form.address.trim(),
        birthday: form.birthday,
        contactNumber: form.contactNumber.trim() || undefined,
        feePaid: form.feePaid,
        validDays: Number(form.validDays) > 0 ? Number(form.validDays) : undefined,
      });
      setIssued(data);
      setForm(EMPTY);
      setQ('');
      toast.success(`Clearance ${data.controlNo} issued`);
      loadRegister();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not issue the clearance');
    } finally {
      setIssuing(false);
    }
  }

  const rows = useMemo(() => {
    const list = statusFilter === 'all'
      ? register
      : register.filter((c) => String(c.status).toLowerCase() === statusFilter);
    return [...list].sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  }, [register, statusFilter]);

  const counts = useMemo(() => {
    const c = { total: register.length, issued: 0, used: 0, void: 0 };
    register.forEach((r) => { c[String(r.status).toLowerCase()] = (c[String(r.status).toLowerCase()] || 0) + 1; });
    return c;
  }, [register]);

  return (
    <PurokLeaderLayout title="Issue Clearance">
      {voidTarget && (
        <VoidModal clearance={voidTarget} onClose={() => setVoidTarget(null)} onDone={loadRegister} />
      )}

      {/* ── Result panel (after a successful issue) ── */}
      {issued && (
        <div className="rounded-2xl p-6 mb-6" style={{ background: '#FFFFFF', border: '1px solid #DCFCE7' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                New purok clearance issued
              </p>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
                {issued.controlNo}
              </p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 13 }}>
                {issued.fullName} · {issued.purok} · valid until {dt(issued.validUntil)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => printSlip(issued, user?.purok, user?.fullName)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
                <FiPrinter size={14} /> Print slip
              </button>
              <button onClick={() => setIssued(null)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#F0FDF4', color: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
                <FiPlus size={14} /> Issue another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Issue form ── */}
      {!issued && (
        <div className="rounded-2xl p-6 mb-6" style={{ background: '#FFFFFF' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18, marginBottom: 4 }}>
            Issue a Purok Clearance
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginBottom: 16 }}>
            The resident pays the fee in cash and leaves with a control number to type at the kiosk.
            Issuing the clearance is your approval — it stands in for reviewing each request.
          </p>

          {/* source toggle */}
          <div className="flex gap-2 mb-5">
            {[
              { key: 'registered', label: 'Registered resident', Icon: FiUserCheck },
              { key: 'walkin', label: 'Walk-in (no account)', Icon: FiUserPlus },
            ].map(({ key, label, Icon }) => (
              <button key={key} onClick={() => switchSource(key)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  fontFamily: "'Hahmlet', sans-serif",
                  background: source === key ? '#156D07' : '#F5F0F0',
                  color: source === key ? '#FFFFFF' : '#827575',
                }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* resident search (registered only) */}
          {source === 'registered' && (
            <div className="mb-5 relative">
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Find the resident in {purok}</label>
              <div className="flex items-center gap-2 rounded-xl px-3" style={FIELD}>
                <FiSearch size={15} color="#827575" />
                <input value={q} onChange={(e) => { setQ(e.target.value); set('userId', null); }}
                  placeholder="Type a name…"
                  className="flex-1 bg-transparent py-2.5 text-sm focus:outline-none"
                  style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333' }} />
                {searching && <span className="text-xs" style={{ color: '#A18D8D' }}>…</span>}
              </div>
              {results.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E0E0', boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }}>
                  {results.map((r) => (
                    <button key={r.userId} onClick={() => pickResident(r)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                      style={{ borderBottom: '1px solid #F7F3F3' }}>
                      <p className="text-sm font-semibold" style={{ color: '#1E1E1E', fontFamily: "'Kaisei Decol', serif" }}>{r.fullName}</p>
                      <p className="text-xs" style={{ color: '#A18D8D', fontFamily: "'Hanken Grotesk', sans-serif" }}>{r.address || '—'}</p>
                    </button>
                  ))}
                </div>
              )}
              {form.userId && (
                <p className="text-xs mt-1" style={{ color: '#156D07', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  ✓ Linked to this resident's account
                </p>
              )}
            </div>
          )}

          {/* fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Full name <span style={{ color: '#DC2626' }}>*</span></label>
              <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={FIELD} />
            </div>
            <div>
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Birth date <span style={{ color: '#DC2626' }}>*</span></label>
              <input type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={FIELD} />
            </div>
            <div className="sm:col-span-2">
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Address <span style={{ color: '#DC2626' }}>*</span></label>
              <input value={form.address} onChange={(e) => set('address', e.target.value)}
                placeholder={`Purok, Brgy. Dologon, Maramag, Bukidnon`}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={FIELD} />
            </div>
            <div>
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Contact number</label>
              <input value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)}
                placeholder="09XXXXXXXXX"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={FIELD} />
            </div>
            <div>
              <label style={{ ...LABEL, display: 'block', marginBottom: 6 }}>Valid for (days)</label>
              <input type="number" min={1} value={form.validDays} onChange={(e) => set('validDays', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={FIELD} />
            </div>
          </div>

          {/* fee + paid */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 rounded-xl px-4 py-3"
            style={{ background: '#F9F7F7', border: '1px solid #F0EAEA' }}>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555', fontSize: 13 }}>
              Purok clearance fee for {purok}:{' '}
              <strong style={{ color: '#156D07' }}>
                {feeCentavos == null ? '—' : pesoFromCentavos(feeCentavos)}
              </strong>
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#555' }}>
              <input type="checkbox" checked={form.feePaid} onChange={(e) => set('feePaid', e.target.checked)} />
              Fee paid in cash
            </label>
          </div>

          <button onClick={issue} disabled={!canIssue}
            className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
            {issuing ? 'Issuing…' : 'Issue clearance'}
          </button>
        </div>
      )}

      {/* ── Issued register ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #F0EAEA' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 16 }}>Clearances you issued</p>
            <div className="flex gap-2">
              {[
                { key: 'all', label: `All ${counts.total}` },
                { key: 'issued', label: `Not used ${counts.issued || 0}` },
                { key: 'used', label: `Used ${counts.used || 0}` },
                { key: 'void', label: `Cancelled ${counts.void || 0}` },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    fontFamily: "'Hahmlet', sans-serif",
                    background: statusFilter === key ? '#156D07' : '#F5F0F0',
                    color: statusFilter === key ? '#FFFFFF' : '#827575',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-xs" style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D' }}>
            One clearance covers a single visit — the resident may take several documents under it. It is
            spent the moment they submit at the kiosk, and cannot be used again.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            <thead>
              <tr style={{ background: '#F9F7F7', borderBottom: '1px solid #F0EAEA', color: '#827575' }}>
                {['', 'Control No.', 'Resident', 'Issued', 'Status', 'Documents processed', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-bold" style={{ fontFamily: "'Hahmlet', sans-serif" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingRegister ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: '#A18D8D' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: '#A18D8D' }}>No clearances here yet.</td></tr>
              ) : (
                rows.map((c) => {
                  const id = c.id || c._id;
                  const reqs = c.requests || [];
                  const isUsed = String(c.status).toLowerCase() === 'used';
                  const open = expanded.has(id);
                  return (
                    <FragmentRow key={id}>
                      <tr style={{ borderBottom: open ? 'none' : '1px solid #F7F3F3' }} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 align-top">
                          {reqs.length > 0 && (
                            <button onClick={() => toggleRow(id)} className="p-1 rounded hover:bg-gray-100" title="Show documents">
                              {open ? <FiChevronDown size={16} color="#827575" /> : <FiChevronRight size={16} color="#827575" />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap align-top" style={{ color: '#1E1E1E', fontFamily: "'Kaisei Decol', serif", letterSpacing: 1 }}>
                          {c.controlNo}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium" style={{ color: '#1E1E1E' }}>{c.fullName}</p>
                          <p className="text-xs" style={{ color: '#A18D8D' }}>{c.userId ? 'Account linked' : 'Walk-in'}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top" style={{ color: '#555' }}>
                          {dt(c.issuedAt)}
                          <span className="block text-xs" style={{ color: '#A18D8D' }}>valid to {dt(c.validUntil)}</span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusBadge status={c.status} />
                          {isUsed && (
                            <span className="block text-xs mt-1" style={{ color: '#A18D8D' }}>
                              on {dtTime(c.usedAt)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top" style={{ color: '#555' }}>
                          {reqs.length === 0 ? (
                            <span style={{ color: '#C0B0B0' }}>—</span>
                          ) : (
                            <button onClick={() => toggleRow(id)} className="text-left">
                              <span className="font-semibold" style={{ color: '#1E1E1E' }}>
                                {reqs.length} document{reqs.length > 1 ? 's' : ''}
                              </span>
                              <span className="block text-xs" style={{ color: '#A18D8D' }}>
                                {reqs.map((r) => r.documentType).join(', ')}
                              </span>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                          <button onClick={() => printSlip(c, user?.purok, user?.fullName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: '#F0FDF4', color: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
                            <FiPrinter size={12} /> Slip
                          </button>
                          {String(c.status).toLowerCase() === 'issued' && (
                            <button onClick={() => setVoidTarget(c)}
                              className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: '#FEF2F2', color: '#DC2626', fontFamily: "'Hahmlet', sans-serif" }}>
                              <FiSlash size={12} /> Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ borderBottom: '1px solid #F7F3F3', background: '#FBFAFA' }}>
                          <td />
                          <td colSpan={6} className="px-4 pb-4 pt-1">
                            <p className="text-xs mb-2" style={{ color: '#827575', fontFamily: "'Hahmlet', sans-serif" }}>
                              Processed on this clearance {c.usedAt ? `· ${dtTime(c.usedAt)}` : ''}
                            </p>
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #F0EAEA' }}>
                              {reqs.map((r, i) => (
                                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2"
                                  style={{ background: '#FFFFFF', borderTop: i ? '1px solid #F7F3F3' : 'none' }}>
                                  <FiCheckCircle size={14} color="#156D07" className="shrink-0" />
                                  <span className="font-semibold" style={{ color: '#1E1E1E' }}>{r.documentType}</span>
                                  <span className="text-xs" style={{ color: '#A18D8D' }}>Purpose: {r.purpose || '—'}</span>
                                  <span className="text-xs" style={{ color: '#A18D8D' }}>OR: {r.orNumber || '—'}</span>
                                  {r.purokLeaderStatus === 'approved' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full"
                                      style={{ background: '#EFF6FF', color: '#2563EB' }}>Approved via clearance</span>
                                  )}
                                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: '#F0FDF4', color: '#156D07' }}>{r.status || 'Pending'}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PurokLeaderLayout>
  );
}

/* Lets a map callback return two <tr>s without an extra wrapper element. */
function FragmentRow({ children }) {
  return <>{children}</>;
}
