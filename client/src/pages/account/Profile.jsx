import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { MdCamera, MdPerson, MdLock, MdLogout } from 'react-icons/md';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import AppLayout from '../../components/layout/AppLayout';
import PasswordStrengthMeter from '../../components/common/PasswordStrengthMeter';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-100">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-primary">
          <Icon size={18} />
        </span>
        <h2 className="font-bold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [fullName, setFullName] = useState(null);

  useEffect(() => {
    api.get('/verification/status')
      .then(({ data }) => setFullName(data.fullName || null))
      .catch(() => {});
  }, []);
const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const newPw = watch('newPassword', '');

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.put('/auth/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = data.avatarUrl || data.data?.avatarUrl || data.url;
      updateUser({ avatar: url });
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handlePasswordChange({ currentPassword, newPassword, confirmPassword }) {
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully!');
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  function handleLogout() {
    logout();
    toast.success('Logged out');
    navigate('/login');
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Profile &amp; Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account information</p>
      </div>

      {/* Profile Info */}
      <Section icon={MdPerson} title="Profile Info">
        <div className="flex items-center gap-5 mb-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-accent/10 ring-2 ring-accent/20 flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{user?.username?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarLoading}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white shadow hover:bg-primary-700 transition-colors"
            >
              {avatarLoading ? <LoadingSpinner size="sm" /> : <MdCamera size={14} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="font-bold text-lg text-ink">{fullName || user?.username}</p>
            {fullName && <p className="text-sm text-gray-500">{user?.username}</p>}
            <p className="text-sm text-gray-500">{user?.contactNumber}</p>
            {user?.email && <p className="text-sm text-gray-500">{user.email}</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Username</label>
            <input value={user?.username || ''} readOnly className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Contact Number</label>
            <input value={user?.contactNumber || ''} readOnly className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
          {user?.email !== undefined && (
            <div>
              <label className="label">Email</label>
              <input value={user?.email || ''} readOnly className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
          )}
        </div>
      </Section>

      {/* Change Password */}
      <Section icon={MdLock} title="Change Password">
        <form onSubmit={handleSubmit(handlePasswordChange)} className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input
                {...register('currentPassword', { required: 'Required' })}
                type={showCurrent ? 'text' : 'password'}
                className="input-field pr-12"
                placeholder="Your current password"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCurrent ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                {...register('newPassword', {
                  required: 'Required',
                  minLength: { value: 8, message: 'Min 8 characters' },
                })}
                type={showNew ? 'text' : 'password'}
                className="input-field pr-12"
                placeholder="New password"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
              </button>
            </div>
            {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
            <PasswordStrengthMeter password={newPw} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              {...register('confirmPassword', { required: 'Required' })}
              type="password"
              className="input-field"
              placeholder="Re-enter new password"
            />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary flex items-center justify-center gap-2 w-full">
            {pwLoading ? <LoadingSpinner size="sm" /> : 'Update Password'}
          </button>
        </form>
      </Section>

      {/* Logout */}
      <div className="card">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors"
        >
          <MdLogout size={20} /> Sign Out
        </button>
      </div>
    </AppLayout>
  );
}
