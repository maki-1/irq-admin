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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(form);
      setAuth(data.user, data.token);
      toast.success(`Welcome, ${data.user.fullName}!`);
      navigate(ROLE_HOME[data.user.role] || '/secretary');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="staff@dologon.gov.ph"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
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
