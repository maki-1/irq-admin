import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function getVerifyRoute(user) {
  if (user.verificationStatus === 'pending') return '/verify/waiting';
  if (user.verificationStatus === 'rejected') return '/verify/step1';
  const step = user.verificationStep ?? 0;
  if (step === 0) return '/verify/step1';
  if (step === 1) return '/verify/step2';
  if (step === 2) return '/verify/step3';
  return '/verify/waiting';
}

export default function Login() {
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, clearErrors } = useForm();

  async function onSubmit({ username, password }) {
    setLoading(true);
    setLoginError('');
    try {
      const { data } = await api.post('/auth/login', { username, password });
      const token = data.token || data.data?.token;
      login(token, data.user || data.data?.user);

      const { data: me } = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = me.user || me.data || me;
      login(token, user);

      toast.success(`Welcome back, ${user.username}!`);
      if (user.isVerified) {
        navigate('/dashboard');
      } else {
        navigate(getVerifyRoute(user));
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-extrabold text-xl">i</span>
            </div>
            <span className="font-extrabold text-2xl text-primary">iRequestD</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {loginError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{loginError}</span>
              </div>
            )}
            <div>
              <label className="label">Username</label>
              <input
                {...register('username', { required: 'Username is required' })}
                className="input-field"
                placeholder="Enter your username"
                autoComplete="username"
                onCopy={e => e.preventDefault()}
                onCut={e => e.preventDefault()}
                onPaste={e => e.preventDefault()}
                onChange={() => setLoginError('')}
              />
              {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  onCopy={e => e.preventDefault()}
                  onCut={e => e.preventDefault()}
                  onPaste={e => e.preventDefault()}
                  onChange={() => setLoginError('')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Link to="/forgot-password" className="text-sm text-primary hover:underline self-end -mt-1">
              Forgot password?
            </Link>

            <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
              {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">Create account</Link>
        </p>
      </div>
    </div>
  );
}
