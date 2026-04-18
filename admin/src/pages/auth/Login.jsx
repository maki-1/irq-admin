import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import assets from '../../assets/cloudinaryAssets';

const ROLE_HOME = {
  Secretary: '/secretary',
  Collector: '/collector',
  'Barangay Captain': '/captain',
};

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address.';
    }
    if (!form.password) {
      newErrors.password = 'Password is required.';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    return newErrors;
  };

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
    if (loginError) setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    setLoginError('');
    try {
      const { data } = await login(form);
      setAuth(data.user, data.token);
      toast.success(`Welcome, ${data.user.fullName}!`);
      navigate(ROLE_HOME[data.user.role] || '/secretary');
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setLoginError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-rich px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${assets.BARANGAYHALL})` }} />
      <div className="absolute inset-0 bg-green-rich/70" />

      <div className="relative w-full max-w-md card">
        <div className="text-center mb-8">
          <img
            src={assets.DOLOGONLOGO}
            alt="Barangay Dologon"
            className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-gold object-cover shadow-lg"
          />
          <h1 className="font-garamond text-3xl font-bold text-gold">iRequestDologon</h1>
          <p className="text-white/50 text-sm mt-1">Barangay Dologon Staff Portal</p>
        </div>

        {loginError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/15 border border-red-500/40 px-4 py-3 text-sm text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className={`input ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder="staff@dologon.gov.ph"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email}</p>
            )}
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className={`input ${errors.password ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 mt-2 text-base"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-8">
          Barangay Dologon · Maramag, Bukidnon
        </p>
      </div>
    </div>
  );
}
