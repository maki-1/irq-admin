import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiPlus, FiKey, FiTrash2, FiX, FiEye, FiEyeOff, FiUser,
} from 'react-icons/fi';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import CaptainLayout from '../../components/layouts/CaptainLayout';

const ROLES = ['Secretary', 'Collector', 'Barangay Captain'];

const ROLE_COLORS = {
  Secretary:         { bg: '#EFF6FF', color: '#1D6DB5' },
  Collector:         { bg: '#FFF7ED', color: '#C2610A' },
  'Barangay Captain':{ bg: '#F0FDF4', color: '#156D07' },
};

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
  const [form, setForm] = useState({ fullName: '', purok: '', email: '', password: '', role: 'Secretary' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.fullName || !form.purok || !form.email || !form.password) {
      toast.error('All fields are required.'); return;
    }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
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
            { label: 'Full Name', key: 'fullName', type: 'text', placeholder: 'e.g. Juan Dela Cruz' },
            { label: 'Purok',     key: 'purok',    type: 'text', placeholder: 'e.g. Purok 1' },
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
            <div className="flex gap-2">
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
  const [deleting,    setDeleting]    = useState(null);

  const fetchUsers = () => {
    api.get('/users')
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreated = (newUser) => setUsers((prev) => [newUser, ...prev]);

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete account for ${u.fullName}? This cannot be undone.`)) return;
    setDeleting(u._id);
    try {
      await api.delete(`/users/${u._id}`);
      toast.success(`${u.fullName}'s account deleted`);
      setUsers((prev) => prev.filter((x) => x._id !== u._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(null);
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
                {!loading && users.map((u, idx) => {
                  const isMe = u._id === me?._id;
                  return (
                    <tr key={u._id} className="transition-colors hover:bg-gray-50"
                      style={{ borderBottom: '1px solid #FAF7F7' }}>

                      <td className="px-5 py-3" style={{ color: '#C0B0B0', fontSize: 13 }}>{idx + 1}</td>

                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ background: '#156D07' }}>
                            {u.fullName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                              {u.fullName} {isMe && <span style={{ color: '#156D07', fontSize: 10 }}>(you)</span>}
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
                            onClick={() => setResetTarget(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#EFF6FF', color: '#1D6DB5', border: '1px solid #BFDBFE' }}
                          >
                            <FiKey size={12} /> Reset PW
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={isMe || deleting === u._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
                            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}
                          >
                            <FiTrash2 size={12} /> {deleting === u._id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="px-5 py-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                {users.length} account{users.length !== 1 ? 's' : ''} in admins collection
              </p>
            </div>
          )}
        </div>
      </div>

      {showCreate  && <CreateModal onClose={() => setShowCreate(false)}  onCreated={handleCreated} />}
      {resetTarget && <ResetModal  onClose={() => setResetTarget(null)} target={resetTarget} />}
    </CaptainLayout>
  );
}
