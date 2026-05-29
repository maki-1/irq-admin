import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PasswordStrengthMeter from '../../components/common/PasswordStrengthMeter';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ResetPassword() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('newPassword', '');

  async function onSubmit({ newPassword, confirmPassword }) {
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: state?.resetToken, newPassword });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!state?.resetToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Invalid or expired reset link.</p>
          <Link to="/forgot-password" className="btn-primary">Request new reset</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your new password below</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  {...register('newPassword', {
                    required: 'Required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                    validate: (v) => {
                      if (!/[A-Z]/.test(v)) return 'Need uppercase letter';
                      if (!/[0-9]/.test(v)) return 'Need a number';
                      if (!/[^A-Za-z0-9]/.test(v)) return 'Need a special character';
                      return true;
                    },
                  })}
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
              {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>}
              <PasswordStrengthMeter password={password} />
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input
                {...register('confirmPassword', { required: 'Required' })}
                type="password"
                className="input-field"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 mt-2">
              {loading ? <LoadingSpinner size="sm" /> : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
