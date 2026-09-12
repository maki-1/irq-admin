import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiPlus, FiKey, FiSlash, FiCheckCircle, FiX, FiEye, FiEyeOff, FiUser, FiEdit2,
  FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import CaptainLayout from '../../components/layouts/CaptainLayout';

const ROLES = ['Secretary', 'Collector', 'Barangay Captain', 'Purok Leader'];

const ROLE_COLORS = {
  Secretary:          { bg: '#EFF6FF', color: '#1D6DB5' },
  Collector:          { bg: '#FFF7ED', color: '#C2610A' },
  'Barangay Captain': { bg: '#F0FDF4', color: '#156D07' },
  'Purok Leader':     { bg: '#FDF4FF', color: '#7C3AED' },
};

const PUROKS = Array.from({ length: 21 }, (_, i) => `Purok ${i + 1}`);
const PAGE_SIZE = 10;

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || { bg: '#F5F5F5', color: '#888' };
  return (
    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {role}
    </span>
  );
}

/* ── Create Account Modal ── */
function CreateModal({ onClose, onCreated }) {
  const [form,    setForm]    = useState({ fullName: '', email: '', password: '', role: 'Secretary', purok: '', contactNumber: '', notifyEmail: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [saving,  setSaving]  = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.password) {
      toast.error('All fields are required.'); return;
    }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (form.role === 'Purok Leader' && !form.purok) { toast.error('Select a purok for this leader.'); return; }
    // A Purok Leader needs a way to be reached for SMS approvals.
    if (form.role === 'Purok Leader' && !form.contactNumber && !form.notifyEmail) {
      toast.error('Add a contact number (for SMS approvals) or a notify email for this leader.'); return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/users', form);
      toast.success(`Account created for ${data.fullName}`);
      onCreated(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18 }}>Create Account</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <FiX size={18} color="#827575" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {[
            { label: 'Full Name', key: 'fullName', type: 'text',  placeholder: 'e.g. Juan Dela Cruz' },
            { label: 'Email',     key: 'email',    type: 'email', placeholder: 'e.g. juan@email.com' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
                {label}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
              />
            </div>
          ))}

          {/* Password */}
          <div>
            <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPw ? <FiEyeOff size={15} color="#A18D8D" /> : <FiEye size={15} color="#A18D8D" />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Role
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('role', r)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                  style={{
                    fontFamily: "'Hahmlet', sans-serif",
                    background:  form.role === r ? (ROLE_COLORS[r]?.bg  || '#F0FDF4') : '#F9F7F7',
                    color:       form.role === r ? (ROLE_COLORS[r]?.color || '#156D07') : '#A18D8D',
                    borderColor: form.role === r ? (ROLE_COLORS[r]?.color || '#156D07') : 'transparent',
                  }}
                >{r}</button>
              ))}
            </div>
          </div>

          {/* Purok selector — only when role is Purok Leader */}
          {form.role === 'Purok Leader' && (
            <div>
              <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
                Assigned Purok <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                value={form.purok}
                onChange={(e) => set('purok', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: form.purok ? '#333' : '#A18D8D' }}
              >
                <option value="">Select a purok…</option>
                {PUROKS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* Contact number — used to SMS a Purok Leader an approval link */}
          <div>
            <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Contact Number {form.role === 'Purok Leader' && <span style={{ color: '#DC2626' }}>*</span>}
              <span style={{ color: '#B9AEAE', fontSize: 11 }}> — for SMS approvals</span>
            </label>
            <input
              type="tel"
              value={form.contactNumber}
              onChange={(e) => set('contactNumber', e.target.value)}
              placeholder="e.g. 09171234567"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
            />
          </div>

          {/* Notify email — where notifications actually reach them (login email
              is institutional and may not receive mail). Optional. */}
          {form.role === 'Purok Leader' && (
            <div>
              <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
                Notify Email <span style={{ color: '#B9AEAE', fontSize: 11 }}>— optional, a reachable inbox</span>
              </label>
              <input
                type="email"
                value={form.notifyEmail}
                onChange={(e) => set('notifyEmail', e.target.value)}
                placeholder="e.g. leader.personal@gmail.com"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
              />
            </div>
          )}

        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#156D07' }}>
            {saving ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Account Modal ── */
function EditModal({ target, onClose, onSaved }) {
  const isLeader = target.role === 'Purok Leader';
  const [form, setForm] = useState({
    fullName: target.fullName || '',
    contactNumber: target.contactNumber || '',
    notifyEmail: target.notifyEmail || '',
    purok: target.purok || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.fullName.trim()) { toast.error('Full name is required.'); return; }
    if (isLeader && !form.contactNumber && !form.notifyEmail) {
      toast.error('A Purok Leader needs a contact number (for SMS approvals) or a notify email.'); return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${target._id}`, form);
      toast.success(`${data.fullName} updated`);
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, opts = {}) => (
    <div>
      <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
        {label}{opts.required && <span style={{ color: '#DC2626' }}> *</span>}
        {opts.hint && <span style={{ color: '#B9AEAE', fontSize: 11 }}> — {opts.hint}</span>}
      </label>
      <input
        type={opts.type || 'text'}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts.placeholder || ''}
        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18 }}>Edit Account</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <FiX size={18} color="#827575" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#F9F7F7' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: '#156D07' }}>
              {target.fullName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>{target.role}</p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>{target.email}</p>
            </div>
          </div>

          {field('Full Name', 'fullName', { required: true })}
          {isLeader && (
            <div>
              <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>Assigned Purok</label>
              <select value={form.purok} onChange={(e) => set('purok', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: form.purok ? '#333' : '#A18D8D' }}>
                <option value="">Select a purok…</option>
                {PUROKS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {field('Contact Number', 'contactNumber', { type: 'tel', placeholder: 'e.g. 09171234567', hint: 'for SMS approvals', required: isLeader })}
          {field('Notify Email', 'notifyEmail', { type: 'email', placeholder: 'e.g. leader.personal@gmail.com', hint: 'optional, a reachable inbox' })}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#156D07' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ── */
function ResetModal({ target, onClose }) {
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [saving,  setSaving]  = useState(false);

  const handleReset = async () => {
    if (pw.length < 6)    { toast.error('Password must be at least 6 characters.'); return; }
    if (pw !== confirm)   { toast.error('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${target._id}/reset-password`, { newPassword: pw });
      toast.success(`Password reset for ${target.fullName}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18 }}>Reset Password</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100">
            <FiX size={18} color="#827575" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: '#F9F7F7' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: '#156D07' }}>
              {target.fullName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>{target.fullName}</p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>{target.email}</p>
            </div>
          </div>

          {[
            { label: 'New Password',     val: pw,      set: setPw      },
            { label: 'Confirm Password', val: confirm, set: setConfirm },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
                {label}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none"
                  style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPw ? <FiEyeOff size={15} color="#A18D8D" /> : <FiEye size={15} color="#A18D8D" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}>
            Cancel
          </button>
          <button onClick={handleReset} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#156D07' }}>
            {saving ? 'Saving…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   USERS PAGE
══════════════════════════════════════════ */
export default function CaptainUsers() {
  const { user: me } = useAuthStore();
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [editTarget,  setEditTarget]  = useState(null);
  const [toggling,    setToggling]    = useState(null);
  const [page,        setPage]        = useState(1);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const fetchUsers = () => {
    api.get('/users')
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreated = (newUser) => { setUsers((prev) => [newUser, ...prev]); setPage(1); };

  const handleToggleActive = async (u) => {
    const deactivating = u.active !== false;
    const verb = deactivating ? 'Deactivate' : 'Reactivate';
    if (!window.confirm(
      deactivating
        ? `Deactivate ${u.fullName}? They will be signed out and cannot log in until reactivated. Their records are kept.`
        : `Reactivate ${u.fullName}? They will be able to log in again.`
    )) return;
    setToggling(u._id);
    try {
      const { data } = await api.patch(`/users/${u._id}/active`, { active: !deactivating });
      toast.success(`${u.fullName} ${deactivating ? 'deactivated' : 'reactivated'}`);
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, ...data } : x)));
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${verb.toLowerCase()}`);
    } finally {
      setToggling(null);
    }
  };

  return (
    <CaptainLayout title="USER MANAGEMENT">
      <div className="flex flex-col gap-4">

        {/* Header card */}
        <div className="bg-white rounded-3xl px-6 py-5 flex items-center justify-between"
          style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div>
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18 }}>Admin Accounts</p>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 4 }}>
              Manage barangay staff accounts from the <code style={{ fontSize: 11 }}>admins</code> collection.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#156D07' }}
          >
            <FiPlus size={15} />
            Create Account
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 580 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0EAEA', background: '#FAFAFA' }}>
                  {['#', 'NAME', 'EMAIL', 'ROLE', 'PUROK', 'ACTIONS'].map((h) => (
                    <th key={h}
                      className={`px-5 py-3 text-left ${h === 'ACTIONS' ? 'text-center' : ''}`}
                      style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 13, fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>Loading…</td></tr>
                )}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>No accounts found</td></tr>
                )}
                {!loading && paged.map((u, idx) => {
                  const isMe = u._id === me?._id;
                  return (
                    <tr key={u._id} className="transition-colors hover:bg-gray-50"
                      style={{ borderBottom: '1px solid #FAF7F7' }}>

                      <td className="px-5 py-3" style={{ color: '#C0B0B0', fontSize: 13 }}>{(safePage - 1) * PAGE_SIZE + idx + 1}</td>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ background: '#156D07' }}>
                            {u.fullName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                              {u.fullName} {isMe && <span style={{ color: '#156D07', fontSize: 10 }}>(you)</span>}
                              {u.active === false && (
                                <span className="ml-2 px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#9CA3AF', fontSize: 10, fontWeight: 700 }}>
                                  INACTIVE
                                </span>
                              )}
                            </p>
                            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                              {new Date(u.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 13 }}>
                          {u.email}
                        </span>
                      </td>

                      <td className="px-5 py-3"><RoleBadge role={u.role} /></td>

                      <td className="px-5 py-3">
                        <span style={{ fontFamily: "'Inika', serif", color: '#A18D8D', fontSize: 13 }}>{u.purok || '—'}</span>
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditTarget(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#F0FDF4', color: '#156D07', border: '1px solid #BBF7D0' }}
                          >
                            <FiEdit2 size={12} /> Edit
                          </button>
                          <button
                            onClick={() => setResetTarget(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#EFF6FF', color: '#1D6DB5', border: '1px solid #BFDBFE' }}
                          >
                            <FiKey size={12} /> Reset PW
                          </button>
                          {(() => {
                            const isActive = u.active !== false;
                            const label = toggling === u._id ? '…' : (isActive ? 'Deactivate' : 'Activate');
                            const style = isActive
                              ? { background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }
                              : { background: '#F0FDF4', color: '#156D07', border: '1px solid #BBF7D0' };
                            return (
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={isMe || toggling === u._id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
                                style={{ fontFamily: "'Hahmlet', sans-serif", ...style }}
                              >
                                {isActive ? <FiSlash size={12} /> : <FiCheckCircle size={12} />} {label}
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                {users.length} account{users.length !== 1 ? 's' : ''} in admins collection
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                    style={{ borderColor: '#E8E0E0', background: safePage === 1 ? '#F9F9F9' : '#FFFFFF', color: safePage === 1 ? '#C0B0B0' : '#156D07' }}
                  >
                    <FiChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                    style={{ borderColor: '#E8E0E0', background: safePage === totalPages ? '#F9F9F9' : '#FFFFFF', color: safePage === totalPages ? '#C0B0B0' : '#156D07' }}
                  >
                    <FiChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate  && <CreateModal onClose={() => setShowCreate(false)}  onCreated={handleCreated} />}
      {editTarget  && <EditModal   onClose={() => setEditTarget(null)}  target={editTarget}
                        onSaved={(updated) => setUsers((prev) => prev.map((x) => (x._id === updated._id ? { ...x, ...updated } : x)))} />}
      {resetTarget && <ResetModal  onClose={() => setResetTarget(null)} target={resetTarget} />}
    </CaptainLayout>
  );
}
