import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiUser, FiMail, FiMapPin, FiBriefcase,
  FiLock, FiEye, FiEyeOff, FiSave,
} from 'react-icons/fi';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import assets from '../../assets/cloudinaryAssets';
import SecretaryLayout from '../../components/layouts/SecretaryLayout';

/* ── Shared input styles ── */
const FIELD = {
  fontFamily: "'Hanken Grotesk', sans-serif",
  fontSize: 14,
  color: '#333',
  background: '#F9F7F7',
  border: '1px solid #E8E0E0',
  borderRadius: 10,
  padding: '10px 14px',
  width: '100%',
  outline: 'none',
};
const LABEL = {
  fontFamily: "'Kaisei Decol', serif",
  fontSize: 13,
  color: '#827575',
  marginBottom: 4,
  display: 'block',
};

function Field({ label, icon: Icon, ...props }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={15} color="#A18D8D"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        )}
        <input style={{ ...FIELD, paddingLeft: Icon ? 36 : 14 }} {...props} />
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, setAuth, token } = useAuthStore();

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email:    user?.email    || '',
    purok:    user?.purok    || '',
  });
  const [pw,     setPw]     = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', {
        fullName: form.fullName,
        email:    form.email,
        purok:    form.purok,
      });
      setAuth(data, token);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pw.current) return toast.error('Enter your current password');
    if (pw.next.length < 6) return toast.error('New password must be at least 6 characters');
    if (pw.next !== pw.confirm) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.patch('/users/me', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password changed!');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const togglePw = (key) => setShowPw((s) => ({ ...s, [key]: !s[key] }));

  return (
    <SecretaryLayout title="MY PROFILE">

      <div className="flex flex-col lg:flex-row gap-5 max-w-4xl">

        {/* ── Left avatar card ── */}
        <div
          className="flex flex-col items-center gap-3 bg-white rounded-3xl p-7 lg:w-64 shrink-0"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)', alignSelf: 'flex-start' }}
        >
          <div className="rounded-full overflow-hidden border-4"
            style={{ width: 110, height: 110, borderColor: '#156D07' }}>
            <img src={assets.DOLOGONLOGO} alt="avatar" className="w-full h-full object-cover" />
          </div>

          <div className="text-center">
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18, fontWeight: 700 }}>
              {user?.fullName}
            </p>
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-white text-xs"
              style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
              {user?.role}
            </span>
          </div>

          <div className="w-full mt-2 flex flex-col gap-2"
            style={{ borderTop: '1px solid #F0EAEA', paddingTop: 14 }}>
            <div className="flex items-center gap-2">
              <FiMail size={13} color="#A18D8D" />
              <span style={{ color: '#A18D8D', fontSize: 12 }}>{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiMapPin size={13} color="#A18D8D" />
              <span style={{ color: '#A18D8D', fontSize: 12 }}>{user?.purok || '—'}</span>
            </div>
          </div>
        </div>

        {/* ── Right forms ── */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">

          {/* Edit Profile form */}
          <form onSubmit={saveProfile} className="bg-white rounded-3xl p-6"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p className="mb-5"
              style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 17 }}>
              Edit Profile
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" icon={FiUser}
                name="fullName" value={form.fullName} onChange={onChange} placeholder="Full name" />
              <Field label="Email" icon={FiMail} type="email"
                name="email" value={form.email} onChange={onChange} placeholder="Email address" />
              <Field label="Purok / Address" icon={FiMapPin}
                name="purok" value={form.purok} onChange={onChange} placeholder="Purok" />
              <div>
                <label style={LABEL}>Role</label>
                <div className="relative">
                  <FiBriefcase size={15} color="#A18D8D"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input readOnly value={user?.role || ''}
                    style={{ ...FIELD, paddingLeft: 36, color: '#A18D8D', cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="mt-5 flex items-center gap-2 px-6 py-2 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60"
              style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
              <FiSave size={15} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          {/* Change Password form */}
          <form onSubmit={savePassword} className="bg-white rounded-3xl p-6"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p className="mb-5"
              style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 17 }}>
              Change Password
            </p>

            <div className="flex flex-col gap-4">
              {[
                { key: 'current', label: 'Current Password'      },
                { key: 'next',    label: 'New Password'           },
                { key: 'confirm', label: 'Confirm New Password'   },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={LABEL}>{label}</label>
                  <div className="relative">
                    <FiLock size={15} color="#A18D8D"
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      value={pw[key]}
                      onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="••••••••"
                      style={{ ...FIELD, paddingLeft: 36, paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => togglePw(key)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer' }}>
                      {showPw[key]
                        ? <FiEyeOff size={15} color="#A18D8D" />
                        : <FiEye    size={15} color="#A18D8D" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={saving}
              className="mt-5 flex items-center gap-2 px-6 py-2 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60"
              style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}>
              <FiLock size={15} />
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </form>

        </div>
      </div>

    </SecretaryLayout>
  );
}
